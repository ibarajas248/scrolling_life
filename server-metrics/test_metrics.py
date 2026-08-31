import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import app


def sample_snapshot():
    return {
        "generated_at": "2026-08-30 13:00:00",
        "cpu": {"percent": 12.5},
        "memory": {"percent": 40},
        "disk": {"root": {"percent": 30}},
        "load": {"one_min": 1.2},
        "network": {"interfaces": {
            "eth0": {"rx_bytes": 100, "tx_bytes": 200},
            "lo": {"rx_bytes": 999, "tx_bytes": 999},
        }},
    }


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.state = patch.multiple(
            app,
            SERVER_METRICS_TOKEN="test-only-token",
            latest_metrics=None,
            latest_metrics_at=None,
            latest_processes=[],
            latest_processes_at=None,
            latest_processes_generated_at=None,
        )
        self.state.start()
        self.addCleanup(self.state.stop)

    def test_metrics_uses_snapshot_without_collecting_processes(self):
        app.latest_metrics = sample_snapshot()
        app.latest_metrics_at = 100
        app.latest_processes = [{"pid": 12}]
        app.latest_processes_at = 98
        with patch.object(app.time, "monotonic", return_value=105), \
             patch.object(app, "collect_metrics", side_effect=AssertionError("live collection")), \
             patch.object(app, "top_processes", side_effect=AssertionError("process scan")):
            response = asyncio.run(app.metrics(None, "test-only-token"))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["snapshot_age_seconds"], 5)
        self.assertEqual(payload["processes_age_seconds"], 7)
        self.assertFalse(payload["stale"])
        self.assertEqual(payload["top_processes"], [{"pid": 12}])
        self.assertNotIn("top_processes", app.latest_metrics)

    def test_empty_cache_returns_explicit_warmup_response(self):
        with self.assertRaises(app.HTTPException) as caught:
            asyncio.run(app.metrics(None, "test-only-token"))
        self.assertEqual(caught.exception.status_code, 503)

    def test_authentication_is_required_even_while_warming_up(self):
        with self.assertRaises(app.HTTPException) as caught:
            asyncio.run(app.metrics(None, "invalid"))
        self.assertEqual(caught.exception.status_code, 401)

    def test_old_snapshot_is_reported_as_stale(self):
        app.latest_metrics = sample_snapshot()
        app.latest_metrics_at = 100
        with patch.object(app.time, "monotonic", return_value=190):
            payload = app.cached_metrics()
        self.assertTrue(payload["stale"])
        self.assertEqual(payload["snapshot_age_seconds"], 90)
        self.assertIsNone(payload["processes_age_seconds"])

    def test_sampler_publishes_metrics_even_when_history_storage_fails(self):
        stop = Mock()
        stop.is_set.side_effect = [False, True]
        snapshot = sample_snapshot()
        with patch.object(app, "sampler_stop", stop), \
             patch.object(app, "collect_metrics", return_value=snapshot), \
             patch.object(app, "init_db", side_effect=OSError("test unavailable disk")), \
             patch("builtins.print"):
            app.sample_loop()
        self.assertEqual(app.latest_metrics, snapshot)
        self.assertIsNotNone(app.latest_metrics_at)
        stop.wait.assert_called_once()

    def test_detailed_process_reads_are_limited_to_top_twenty(self):
        processes = []
        for pid in range(500):
            rss = pid * 1024 * 1024
            process = Mock()
            process.info = {"pid": pid, "memory_info": SimpleNamespace(rss=rss)}
            process.as_dict.return_value = {
                "pid": pid, "name": "worker", "username": "app",
                "status": "sleeping", "cmdline": ["worker"],
            }
            processes.append(process)
        with patch.object(app.psutil, "process_iter", return_value=iter(processes)) as scan:
            result = app.top_processes()
        scan.assert_called_once_with(["pid", "memory_info"], ad_value=None)
        self.assertEqual([row["pid"] for row in result], list(range(499, 479, -1)))
        self.assertEqual(sum(process.as_dict.call_count for process in processes), 20)

    def test_history_reuses_the_same_sample_and_excludes_loopback(self):
        sample = app.resource_sample(sample_snapshot())
        self.assertEqual(sample["cpu_percent"], 12.5)
        self.assertEqual(sample["rx_bytes"], 100)
        self.assertEqual(sample["tx_bytes"], 200)

    def test_health_is_independent_of_samplers(self):
        self.assertEqual(asyncio.run(app.healthz()), {"ok": True})


if __name__ == "__main__":
    unittest.main()
