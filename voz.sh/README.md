# voz.sh

Abrir https://scrollinglife.com/voz.sh/ en Chrome, pulsar **Activar micrófono**,
permitir el acceso y hablar en español. La vista previa muestra resultados
provisionales; solo las frases definitivas se publican en `/api/voz`.
El reconocimiento puede requerir el servicio de internet del navegador.
No se guardan archivos de audio en nuestro servidor; el texto es público.

En Windows, con la XP-58 instalada y conectada por USB:

```powershell
python -m pip install -r scripts/input-print-requirements.txt
python scripts/voice-print.py --printer XP-58
```

El script nuevo reutiliza el envío RAW ya probado, consulta cada segundo y
mantiene su estado independiente en `.local-backup/input-print/voice-state.json`.
La primera ejecución omite frases anteriores. Dejar el equipo encendido y
el proceso activo. No inicia automáticamente al reiniciar Windows.
Se conserva un máximo de 500 frases en el servidor, separadas de `/api/input`.

Los reintentos de envío reutilizan el mismo ID para evitar duplicados.
La página mantiene frases pendientes mientras permanezca abierta y advierte
al intentar cerrarla con envíos pendientes. «Detener» apaga la escucha, pero
termina de enviar frases confirmadas. El estado «enviado» no confirma papel.
Si una impresión se interrumpe, revisar papel/cola y ejecutar el script con
`--resolve sent` (ya enviada) o `--resolve retry` (no enviada).

Referencia del reconocimiento:
https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
