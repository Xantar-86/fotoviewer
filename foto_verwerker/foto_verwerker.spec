# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec voor FotoVerwerker
# Gebruik: pyinstaller foto_verwerker.spec

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Haar cascade voor gezichtsdetectie (OpenCV)
        (
            __import__('cv2').data.haarcascades + 'haarcascade_frontalface_default.xml',
            'cv2/data'
        ),
    ],
    hiddenimports=[
        # PIL / Pillow
        'PIL', 'PIL.Image', 'PIL.ImageFilter', 'PIL.ImageDraw',
        'PIL.ImageFont', 'PIL.ImageOps', 'PIL.ImageEnhance',
        'PIL._imaging', 'PIL.JpegImagePlugin', 'PIL.PngImagePlugin',
        'PIL.GifImagePlugin', 'PIL.WebPImagePlugin', 'PIL.BmpImagePlugin',
        'PIL.TiffImagePlugin',
        # OpenCV
        'cv2',
        # NumPy
        'numpy', 'numpy.core', 'numpy.core._multiarray_umath',
        # Anthropic SDK
        'anthropic', 'anthropic.types', 'anthropic._client',
        'httpx', 'httpcore', 'anyio', 'certifi',
        # PyQt6
        'PyQt6', 'PyQt6.QtWidgets', 'PyQt6.QtCore', 'PyQt6.QtGui',
        'PyQt6.sip',
        # Cryptography (versleutelde backup)
        'cryptography', 'cryptography.fernet',
        'cryptography.hazmat.primitives.ciphers',
        'cryptography.hazmat.backends.openssl',
        'cryptography.hazmat.backends',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'matplotlib', 'scipy', 'pandas',
        'IPython', 'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FotoVerwerker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,          # Geen console venster
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,              # Voeg hier je .ico bestand toe indien gewenst
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='FotoVerwerker',
)
