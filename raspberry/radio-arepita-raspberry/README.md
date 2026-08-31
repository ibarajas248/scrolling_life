# Radio Arepita para Raspberry

Paquete para dejar una Raspberry Pi como reproductor/kiosko de Radio Arepita.

Por defecto abre:

```txt
https://radio.testivanbarajas.cloud/radio
```

## Instalar en la Raspberry

1. Copia `radio-arepita-raspberry.zip` a la Raspberry.
2. Descomprime:

```bash
unzip radio-arepita-raspberry.zip
cd radio-arepita-raspberry
```

3. Ejecuta:

```bash
chmod +x bin/*.sh
./bin/install-radio-arepita.sh
```

4. Reinicia la Raspberry:

```bash
sudo reboot
```

## Cambiar la emisora

Edita:

```bash
nano ~/.config/radio-arepita/radio-arepita.env
```

Cambia `RADIO_URL` y reinicia el servicio:

```bash
systemctl --user restart radio-arepita.service
```

## Comandos utiles

```bash
systemctl --user status radio-arepita.service
systemctl --user restart radio-arepita.service
systemctl --user stop radio-arepita.service
systemctl --user disable radio-arepita.service
```

## Desinstalar

```bash
./bin/uninstall-radio-arepita.sh
```

## Notas

- Funciona mejor con Raspberry Pi OS Desktop, porque abre Chromium en modo kiosko.
- Si la URL no responde al arrancar, se muestra una pantalla local `NO SIGNAL`.
- Si tienes una URL directa de stream `.mp3`, `.aac` u `.ogg`, tambien puedes ponerla en `RADIO_URL`.
