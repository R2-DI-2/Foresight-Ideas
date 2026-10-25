#!/usr/bin/env python3
"""
Локальный статический сервер для платформы «Глобальный форсайт технологической
эволюции». Внешних обращений к источникам данных нет (демонстрационная стадия);
сервер отдаёт только файлы приложения.

Порт выбирается так: переменная окружения PORT → аргумент командной строки →
8780 по умолчанию. Сервер всегда отдаёт файлы из каталога этого скрипта,
независимо от текущей рабочей директории.

Запуск:
    python3 serve.py            # порт 8780 (или $PORT)
    python3 serve.py 9000       # другой порт

Затем открыть: http://localhost:<порт>/index.html
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# отдаём файлы из каталога скрипта (устойчиво к запуску из другой директории)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8780))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # без кэширования — правки файлов подхватываются при перезагрузке
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print("Глобальный форсайт технологической эволюции (до 2050)")
    print("Открывайте: http://localhost:%d/index.html" % PORT)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
