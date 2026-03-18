#!/usr/bin/env python3
"""
FotoVerwerker v2 — Product Foto Processor met Claude AI
========================================================
Alle functies: EXIF, Blur, Crop, Verbetering, Watermerk,
Gezichtsdetectie, Batch, Presets, AI Analyse, Business Tracker, Backup.
"""

import sys
import os
import uuid
import io
from datetime import datetime
from pathlib import Path

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QSlider, QSpinBox, QDoubleSpinBox,
    QLineEdit, QTextEdit, QComboBox, QFileDialog, QListWidget,
    QListWidgetItem, QGroupBox, QScrollArea, QSplitter,
    QStatusBar, QMessageBox, QProgressBar, QTabWidget,
    QSizePolicy, QRubberBand, QColorDialog, QCheckBox,
    QTableWidget, QTableWidgetItem, QHeaderView, QDateEdit,
    QInputDialog, QFrame
)
from PyQt6.QtCore import Qt, QRect, QPoint, QSize, QSettings, QDate
from PyQt6.QtGui import (
    QPixmap, QImage, QPainter, QPen, QColor, QAction,
    QDragEnterEvent, QDropEvent
)

from PIL import Image
import cv2
import numpy as np

# Lokale modules
from tools import (
    add_text_watermark, add_logo_watermark, POSITION_MAP, POSITION_KEYS,
    auto_enhance, detect_faces, resize_for_platform, PLATFORM_PRESETS, PLATFORM_NAMES,
    strip_exif, normalize_image_mode,
    PresetManager, BackupManager, calculate_bundle_price,
)
from workers import (
    ClaudeWorker, TitleWorker, SessionIdeasWorker,
    ReplyTemplateWorker, BatchWorker,
)
from data import init_db, IncomeTracker, OrderManager


# ─────────────────────────────────────────────────────────────
# IMAGE CANVAS
# ─────────────────────────────────────────────────────────────

class ImageCanvas(QLabel):
    """Hoofd bewerkingsgebied — drag-drop, blur-selectie, crop-preview."""

    from PyQt6.QtCore import pyqtSignal
    image_changed = pyqtSignal()
    file_dropped  = pyqtSignal(str)

    def __init__(self):
        super().__init__()
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumSize(400, 400)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setAcceptDrops(True)
        self._empty_style()

        self.original_image: Image.Image | None = None
        self.working_image:  Image.Image | None = None
        self.active_tool:    str | None = None
        self.blur_strength:  int = 15

        self._rubber  = QRubberBand(QRubberBand.Shape.Rectangle, self)
        self._sel_start: QPoint | None = None
        self._sel_rect:  QRect  | None = None
        self._disp_rect = QRect()

        self.crop_margins = {"top": 0, "right": 0, "bottom": 0, "left": 0}
        self.show_crop_preview = False

        self.setText("Sleep foto's hiernaartoe\nof gebruik Bestand › Openen")

    def _empty_style(self):
        self.setStyleSheet(
            "QLabel{background:#2b2b2b;border:2px dashed #555;color:#888;font-size:16px;}"
        )

    # ── Laden ─────────────────────────────────────────────────

    def load_image(self, img: Image.Image):
        self.original_image = img.copy()
        self.working_image  = img.copy()
        self.setStyleSheet("QLabel{background:#2b2b2b;}")
        self._refresh()

    def get_current_image(self) -> Image.Image | None:
        return self.working_image

    # ── Weergave ─────────────────────────────────────────────

    def _refresh(self):
        if self.working_image is None:
            return
        img = self.working_image.copy()
        if img.mode == "RGBA":
            fmt, ch = QImage.Format.Format_RGBA8888, 4
        else:
            img = img.convert("RGB")
            fmt, ch = QImage.Format.Format_RGB888, 3

        qimg = QImage(img.tobytes(), img.width, img.height, img.width * ch, fmt)
        pix  = QPixmap.fromImage(qimg)
        sc   = pix.scaled(self.size(),
                          Qt.AspectRatioMode.KeepAspectRatio,
                          Qt.TransformationMode.SmoothTransformation)
        ox = (self.width()  - sc.width())  // 2
        oy = (self.height() - sc.height()) // 2
        self._disp_rect = QRect(ox, oy, sc.width(), sc.height())

        if self.show_crop_preview:
            sc = self._draw_crop_overlay(sc)
        self.setPixmap(sc)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._refresh()

    # ── Coördinaten ──────────────────────────────────────────

    def _to_img(self, pt: QPoint) -> QPoint | None:
        if self.working_image is None or self._disp_rect.isEmpty():
            return None
        dr = self._disp_rect
        iw, ih = self.working_image.size
        x = max(dr.x(), min(pt.x(), dr.right()))
        y = max(dr.y(), min(pt.y(), dr.bottom()))
        return QPoint(
            max(0, min(int((x - dr.x()) * iw / dr.width()),  iw - 1)),
            max(0, min(int((y - dr.y()) * ih / dr.height()), ih - 1)),
        )

    # ── Muis / Drag ───────────────────────────────────────────

    def mousePressEvent(self, event):
        if self.working_image and event.button() == Qt.MouseButton.LeftButton:
            if self.active_tool == "blur":
                self._sel_start = event.pos()
                self._rubber.setGeometry(QRect(self._sel_start, QSize()))
                self._rubber.show()

    def mouseMoveEvent(self, event):
        if self._sel_start is not None:
            r = QRect(self._sel_start, event.pos()).normalized()
            self._rubber.setGeometry(r)
            self._sel_rect = r

    def mouseReleaseEvent(self, event):
        if self._sel_start is not None:
            self._rubber.hide()
            if self.active_tool == "blur" and self._sel_rect:
                self._do_blur()
            self._sel_start = None
            self._sel_rect  = None

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        for url in event.mimeData().urls():
            p = url.toLocalFile()
            if p.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif")):
                self.file_dropped.emit(p)
                break

    # ── Bewerkingen ───────────────────────────────────────────

    def _do_blur(self):
        p1 = self._to_img(self._sel_rect.topLeft())
        p2 = self._to_img(self._sel_rect.bottomRight())
        if p1 is None or p2 is None:
            return
        x1, y1, x2, y2 = p1.x(), p1.y(), p2.x(), p2.y()
        if x2 - x1 < 4 or y2 - y1 < 4:
            return
        arr = np.array(self.working_image)
        k = max(3, self.blur_strength * 2 + 1) | 1  # odd number
        arr[y1:y2, x1:x2] = cv2.GaussianBlur(arr[y1:y2, x1:x2], (k, k), 0)
        self.working_image = Image.fromarray(arr, self.working_image.mode)
        self._refresh()
        self.image_changed.emit()

    def apply_crop(self, margins: dict):
        if self.working_image is None:
            return
        iw, ih = self.working_image.size
        x1 = margins["left"]
        y1 = margins["top"]
        x2 = iw - margins["right"]
        y2 = ih - margins["bottom"]
        if x2 > x1 and y2 > y1:
            self.working_image = self.working_image.crop((x1, y1, x2, y2))
            self._refresh()
            self.image_changed.emit()

    def apply_enhancement(self, brightness: float, contrast: float,
                          color: float, sharpness: float):
        if self.working_image is None:
            return
        self.working_image = auto_enhance(
            self.working_image, brightness, contrast, color, sharpness
        )
        self._refresh()
        self.image_changed.emit()

    def apply_watermark(self, settings: dict):
        if self.working_image is None:
            return
        if settings.get("type") == "text":
            result = add_text_watermark(self.working_image.copy(), settings)
        elif settings.get("type") == "logo":
            result = add_logo_watermark(self.working_image.copy(), settings)
        else:
            return
        if result is not None:
            self.working_image = result
            self._refresh()
            self.image_changed.emit()

    def apply_platform_resize(self, platform: str):
        if self.working_image is None:
            return
        self.working_image = resize_for_platform(self.working_image, platform)
        self._refresh()
        self.image_changed.emit()

    def remove_exif(self):
        if self.working_image is None:
            return
        self.working_image = strip_exif(self.working_image)
        self._refresh()
        self.image_changed.emit()

    def reset_to_original(self):
        if self.original_image:
            self.working_image = self.original_image.copy()
            self._refresh()
            self.image_changed.emit()

    def refresh_display(self):
        """Publieke methode om de weergave te vernieuwen (bijv. na crop-preview toggle)."""
        self._refresh()

    # ── Crop preview overlay ──────────────────────────────────

    def _draw_crop_overlay(self, pix: QPixmap) -> QPixmap:
        if not self.working_image:
            return pix
        iw, ih = self.working_image.size
        m = self.crop_margins
        dr = self._disp_rect
        sx, sy = dr.width() / iw, dr.height() / ih
        dx1 = int(dr.x() + m["left"]  * sx)
        dy1 = int(dr.y() + m["top"]   * sy)
        dx2 = int(dr.x() + (iw - m["right"])  * sx)
        dy2 = int(dr.y() + (ih - m["bottom"]) * sy)

        result = QPixmap(pix)
        p = QPainter(result)
        ov = QColor(0, 0, 0, 110)
        for rx, ry, rw, rh in [
            (dr.x(), dr.y(), dr.width(), dy1 - dr.y()),
            (dr.x(), dy2,   dr.width(), dr.bottom() - dy2 + 1),
            (dr.x(), dy1,   dx1 - dr.x(), dy2 - dy1),
            (dx2,    dy1,   dr.right() - dx2 + 1, dy2 - dy1),
        ]:
            if rw > 0 and rh > 0:
                p.fillRect(QRect(rx, ry, rw, rh), ov)
        p.setPen(QPen(QColor(255, 220, 0), 2))
        p.drawRect(dx1, dy1, dx2 - dx1, dy2 - dy1)
        p.end()
        return result


# ─────────────────────────────────────────────────────────────
# MAIN WINDOW
# ─────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):

    def __init__(self):
        super().__init__()
        self.setWindowTitle("FotoVerwerker v2 – Product Foto Processor")
        self.setMinimumSize(1280, 800)
        self.resize(1500, 960)

        self._file_list:    list[str] = []
        self._current_path: str | None = None
        self._settings = QSettings("FotoVerwerker", "App")

        # Worker referenties
        self._ai_worker:    ClaudeWorker       | None = None
        self._title_worker: TitleWorker        | None = None
        self._ideas_worker: SessionIdeasWorker | None = None
        self._reply_worker: ReplyTemplateWorker| None = None
        self._batch_worker: BatchWorker        | None = None

        # Kleuren / data helpers
        self._wm_color    = (255, 255, 255)
        self._preset_mgr  = PresetManager()
        self._backup_mgr  = BackupManager()
        self._income_tr   = IncomeTracker()
        self._order_mgr   = OrderManager()

        init_db()

        self._build_ui()
        self._build_menu()
        self._build_toolbar()
        self._apply_theme()
        self._load_settings()

    # ══════════════════════════════════════════════════════════
    # UI OPBOUW
    # ══════════════════════════════════════════════════════════

    def _build_ui(self):
        c = QWidget()
        self.setCentralWidget(c)
        root = QHBoxLayout(c)
        root.setContentsMargins(4, 4, 4, 4)
        root.setSpacing(4)

        sp = QSplitter(Qt.Orientation.Horizontal)
        sp.addWidget(self._make_file_panel())
        sp.addWidget(self._make_center_panel())
        sp.addWidget(self._make_right_panel())
        sp.setSizes([220, 780, 380])
        sp.setChildrenCollapsible(False)
        root.addWidget(sp)

        self._status = QStatusBar()
        self.setStatusBar(self._status)
        self._pb = QProgressBar()
        self._pb.setMaximumWidth(220)
        self._pb.setVisible(False)
        self._status.addPermanentWidget(self._pb)
        self._status.showMessage("Gereed. Sleep foto's in de app om te beginnen.")

    # ── Linkerpaneel ─────────────────────────────────────────

    def _make_file_panel(self) -> QWidget:
        w = QWidget()
        w.setMaximumWidth(240)
        w.setMinimumWidth(180)
        lay = QVBoxLayout(w)
        lay.setContentsMargins(2, 2, 2, 2)

        hdr = QLabel("📁  Foto's")
        hdr.setStyleSheet("font-weight:bold;font-size:13px;padding:6px;background:#333;")
        lay.addWidget(hdr)

        row = QHBoxLayout()
        b1 = QPushButton("＋ Toevoegen"); b1.clicked.connect(self._open_files)
        b2 = QPushButton("✕ Wissen");    b2.clicked.connect(self._clear_list)
        row.addWidget(b1); row.addWidget(b2)
        lay.addLayout(row)

        self._flist = QListWidget()
        self._flist.setAcceptDrops(True)
        self._flist.itemClicked.connect(self._file_clicked)
        self._flist.dragEnterEvent = lambda e: e.acceptProposedAction() if e.mimeData().hasUrls() else None
        self._flist.dropEvent = self._list_drop
        lay.addWidget(self._flist)

        self._fcount = QLabel("0 foto's")
        self._fcount.setStyleSheet("color:#888;font-size:11px;padding:3px;")
        lay.addWidget(self._fcount)
        return w

    # ── Centerpaneel ─────────────────────────────────────────

    def _make_center_panel(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(4)

        self.canvas = ImageCanvas()
        self.canvas.image_changed.connect(self._canvas_changed)
        self.canvas.file_dropped.connect(self._load_file)
        lay.addWidget(self.canvas)

        tbar = QWidget(); tbar.setFixedHeight(46)
        tlay = QHBoxLayout(tbar)
        tlay.setContentsMargins(6, 4, 6, 4)

        self._btn_no_tool   = QPushButton("🖱  Uit");       self._btn_no_tool.setCheckable(True);   self._btn_no_tool.setChecked(True)
        self._btn_blur_tool = QPushButton("🌫  Blur Tool"); self._btn_blur_tool.setCheckable(True)
        btn_reset           = QPushButton("↺  Origineel")

        self._btn_no_tool.clicked.connect(lambda: self._set_tool(None))
        self._btn_blur_tool.clicked.connect(lambda: self._set_tool("blur"))
        btn_reset.clicked.connect(self._reset_image)

        for b in (self._btn_no_tool, self._btn_blur_tool, btn_reset):
            b.setFixedHeight(34); tlay.addWidget(b)
        tlay.addStretch()

        self._img_info = QLabel("")
        self._img_info.setStyleSheet("color:#aaa;font-size:11px;")
        tlay.addWidget(self._img_info)
        lay.addWidget(tbar)
        return w

    # ── Rechterpaneel (twee tab-groepen) ─────────────────────

    def _make_right_panel(self) -> QWidget:
        w = QWidget()
        w.setMinimumWidth(320)
        w.setMaximumWidth(420)
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        # Boven: foto-bewerkingstabs
        t1 = QTabWidget()
        t1.addTab(self._tab_privacy(),   "🔒 Privacy")
        t1.addTab(self._tab_enhance(),   "✨ Verbeteren")
        t1.addTab(self._tab_watermark(), "💧 Watermerk")
        t1.addTab(self._tab_batch(),     "📁 Batch")
        t1.addTab(self._tab_presets(),   "⭐ Presets")

        # Onder: AI + business-tabs
        t2 = QTabWidget()
        t2.addTab(self._tab_ai(),        "🤖 AI Foto")
        t2.addTab(self._tab_ai_tools(),  "💡 AI Tools")
        t2.addTab(self._tab_export(),    "📤 Export")
        t2.addTab(self._tab_business(),  "💰 Business")
        t2.addTab(self._tab_backup(),    "🔐 Backup")

        sp = QSplitter(Qt.Orientation.Vertical)
        sp.addWidget(t1); sp.addWidget(t2)
        sp.setSizes([460, 440])
        lay.addWidget(sp)
        return w

    # ══════════════════════════════════════════════════════════
    # TAB BUILDERS
    # ══════════════════════════════════════════════════════════

    # ── Privacy tab ───────────────────────────────────────────

    def _tab_privacy(self) -> QScrollArea:
        sc, lay = self._scroll()

        # EXIF
        g1 = QGroupBox("📋  EXIF Metadata")
        gl = QVBoxLayout(g1)
        gl.addWidget(self._note("Verwijdert GPS, apparaatinfo, datum en alle metadata."))
        b = QPushButton("🗑  Verwijder EXIF")
        b.setStyleSheet("QPushButton{background:#c0392b;padding:8px;}")
        b.clicked.connect(self._remove_exif)
        gl.addWidget(b)
        lay.addWidget(g1)

        # Blur
        g2 = QGroupBox("🌫  Blur Tool")
        gl2 = QVBoxLayout(g2)
        gl2.addWidget(self._note("Activeer de tool en sleep over een gebied om het te vervagen."))
        ba = QPushButton("🌫  Activeer Blur Tool")
        ba.setStyleSheet("QPushButton{background:#1a6edc;padding:8px;}")
        ba.clicked.connect(lambda: self._set_tool("blur"))
        gl2.addWidget(ba)

        sr = QHBoxLayout(); sr.addWidget(QLabel("Sterkte:"))
        self._blur_sl = QSlider(Qt.Orientation.Horizontal)
        self._blur_sl.setRange(1, 50); self._blur_sl.setValue(15)
        self._blur_lbl = QLabel("15")
        self._blur_sl.valueChanged.connect(lambda v: (setattr(self.canvas, "blur_strength", v), self._blur_lbl.setText(str(v))))
        sr.addWidget(self._blur_sl); sr.addWidget(self._blur_lbl)
        gl2.addLayout(sr)
        lay.addWidget(g2)

        # Crop
        g3 = QGroupBox("✂  Bijsnijden")
        gl3 = QVBoxLayout(g3)
        gl3.addWidget(QLabel("Marges (pixels):"))
        srow = QHBoxLayout()
        self._mspins: dict[str, QSpinBox] = {}
        for key, lbl in [("top","Boven"),("right","Rechts"),("bottom","Onder"),("left","Links")]:
            col = QVBoxLayout()
            ll = QLabel(lbl); ll.setAlignment(Qt.AlignmentFlag.AlignCenter); ll.setStyleSheet("font-size:10px;")
            sp2 = QSpinBox(); sp2.setRange(0,9999); sp2.setMaximumWidth(65)
            sp2.valueChanged.connect(self._margin_changed)
            self._mspins[key] = sp2
            col.addWidget(ll); col.addWidget(sp2); srow.addLayout(col)
        gl3.addLayout(srow)
        self._chk_crop_prev = QCheckBox("Toon preview")
        self._chk_crop_prev.toggled.connect(self._toggle_crop_prev)
        gl3.addWidget(self._chk_crop_prev)
        bc = QPushButton("✂  Bijsnijden toepassen")
        bc.setStyleSheet("QPushButton{background:#196c40;padding:8px;}")
        bc.clicked.connect(self._apply_crop)
        gl3.addWidget(bc)
        lay.addWidget(g3)

        lay.addStretch()
        return sc

    # ── Verbeteren tab ────────────────────────────────────────

    def _tab_enhance(self) -> QScrollArea:
        sc, lay = self._scroll()

        g = QGroupBox("✨  Auto verbetering")
        gl = QVBoxLayout(g)
        self._enh_sliders: dict[str, QSlider] = {}
        self._enh_lbls:    dict[str, QLabel]  = {}

        for key, lbl, lo, hi, default in [
            ("brightness", "Helderheid", 50, 200, 100),
            ("contrast",   "Contrast",   50, 200, 100),
            ("color",      "Kleur",      50, 200, 100),
            ("sharpness",  "Scherpte",   50, 200, 100),
        ]:
            row = QHBoxLayout()
            ql = QLabel(f"{lbl}:"); ql.setMinimumWidth(72)
            sl = QSlider(Qt.Orientation.Horizontal)
            sl.setRange(lo, hi); sl.setValue(default)
            vl = QLabel(f"{default/100:.1f}×")
            vl.setMinimumWidth(36)

            def _cb(v, _lbl=vl, _sl=sl):
                _lbl.setText(f"{v/100:.1f}×")

            sl.valueChanged.connect(_cb)
            self._enh_sliders[key] = sl
            self._enh_lbls[key]   = vl
            row.addWidget(ql); row.addWidget(sl); row.addWidget(vl)
            gl.addLayout(row)

        btn_enh = QPushButton("✨  Verbetering toepassen")
        btn_enh.setStyleSheet("QPushButton{background:#196c40;padding:8px;}")
        btn_enh.clicked.connect(self._apply_enhance)
        gl.addWidget(btn_enh)

        btn_reset_enh = QPushButton("↺  Reset sliders")
        btn_reset_enh.clicked.connect(self._reset_enh_sliders)
        gl.addWidget(btn_reset_enh)
        lay.addWidget(g)

        # Gezichtsdetectie
        g2 = QGroupBox("👁  Gezichtsdetectie")
        gl2 = QVBoxLayout(g2)
        gl2.addWidget(self._note("Waarschuwing als er een gezicht in de foto staat."))
        self._face_result = QLabel("—")
        self._face_result.setStyleSheet("font-size:12px;padding:4px;")
        gl2.addWidget(self._face_result)
        bf = QPushButton("🔍  Controleer op gezichten")
        bf.clicked.connect(self._check_faces)
        gl2.addWidget(bf)
        lay.addWidget(g2)

        # Platform resize
        g3 = QGroupBox("📐  Platform formaat")
        gl3 = QVBoxLayout(g3)
        self._platform_combo = QComboBox()
        self._platform_combo.addItems(PLATFORM_NAMES)
        gl3.addWidget(self._platform_combo)
        gl3.addWidget(self._note("Pas de afbeelding aan naar de optimale afmetingen voor het gekozen platform."))
        bp = QPushButton("📐  Formaat aanpassen")
        bp.setStyleSheet("QPushButton{background:#6f42c1;padding:8px;}")
        bp.clicked.connect(self._apply_platform)
        gl3.addWidget(bp)
        lay.addWidget(g3)

        lay.addStretch()
        return sc

    # ── Watermerk tab ─────────────────────────────────────────

    def _tab_watermark(self) -> QScrollArea:
        sc, lay = self._scroll()

        g0 = QGroupBox("Type")
        gl0 = QVBoxLayout(g0)
        self._wm_type = QComboBox()
        self._wm_type.addItems(["Tekst watermerk", "Logo / afbeelding"])
        self._wm_type.currentIndexChanged.connect(self._wm_type_changed)
        gl0.addWidget(self._wm_type)
        lay.addWidget(g0)

        # Tekst
        self._wm_txt_grp = QGroupBox("📝  Tekst")
        tl = QVBoxLayout(self._wm_txt_grp)
        self._wm_text = QLineEdit("© Mijn Bedrijf")
        tl.addWidget(self._wm_text)
        frow = QHBoxLayout(); frow.addWidget(QLabel("Grootte:"))
        self._wm_fsize = QSpinBox(); self._wm_fsize.setRange(8,300); self._wm_fsize.setValue(40)
        frow.addWidget(self._wm_fsize); frow.addStretch(); tl.addLayout(frow)
        crow = QHBoxLayout(); crow.addWidget(QLabel("Kleur:"))
        self._wm_clr_btn = QPushButton("     "); self._wm_clr_btn.setStyleSheet("background:white;")
        self._wm_clr_btn.clicked.connect(self._pick_color)
        crow.addWidget(self._wm_clr_btn); crow.addStretch(); tl.addLayout(crow)
        lay.addWidget(self._wm_txt_grp)

        # Logo
        self._wm_logo_grp = QGroupBox("🖼  Logo")
        ll = QVBoxLayout(self._wm_logo_grp)
        self._wm_logo_path = QLineEdit(); self._wm_logo_path.setPlaceholderText("Geen logo…"); self._wm_logo_path.setReadOnly(True)
        ll.addWidget(self._wm_logo_path)
        bl = QPushButton("📂  Logo kiezen…"); bl.clicked.connect(self._pick_logo); ll.addWidget(bl)
        lsr = QHBoxLayout(); lsr.addWidget(QLabel("Grootte (%):"))
        self._wm_logo_size = QSpinBox(); self._wm_logo_size.setRange(3,60); self._wm_logo_size.setValue(15)
        lsr.addWidget(self._wm_logo_size); ll.addLayout(lsr)
        self._wm_logo_grp.setVisible(False)
        lay.addWidget(self._wm_logo_grp)

        # Gemeenschappelijk
        gc = QGroupBox("⚙  Instellingen")
        gcl = QVBoxLayout(gc)
        pr = QHBoxLayout(); pr.addWidget(QLabel("Positie:"))
        self._wm_pos = QComboBox()
        self._wm_pos.addItems(["Rechtsonder","Linksboven","Rechtsboven","Linksonder","Midden","Boven-midden","Onder-midden"])
        pr.addWidget(self._wm_pos); gcl.addLayout(pr)
        opr = QHBoxLayout(); opr.addWidget(QLabel("Transparantie:"))
        self._wm_opacity = QSlider(Qt.Orientation.Horizontal); self._wm_opacity.setRange(10,255); self._wm_opacity.setValue(180)
        self._wm_op_lbl = QLabel("180")
        self._wm_opacity.valueChanged.connect(lambda v: self._wm_op_lbl.setText(str(v)))
        opr.addWidget(self._wm_opacity); opr.addWidget(self._wm_op_lbl); gcl.addLayout(opr)
        lay.addWidget(gc)

        bw = QPushButton("💧  Watermerk toepassen")
        bw.setStyleSheet("QPushButton{background:#5b2d8e;padding:10px;font-weight:bold;}")
        bw.clicked.connect(self._apply_watermark)
        lay.addWidget(bw)

        lay.addStretch()
        return sc

    # ── Batch tab ─────────────────────────────────────────────

    def _tab_batch(self) -> QScrollArea:
        sc, lay = self._scroll()

        # Bronmap
        gf = QGroupBox("📂  Bronmap")
        gfl = QVBoxLayout(gf)
        self._batch_src = QLineEdit(); self._batch_src.setReadOnly(True); self._batch_src.setPlaceholderText("Selecteer een map…")
        gfl.addWidget(self._batch_src)
        bf = QPushButton("📂  Map kiezen…"); bf.clicked.connect(self._pick_batch_src); gfl.addWidget(bf)
        lay.addWidget(gf)

        # Bewerkingen
        gb = QGroupBox("⚙  Bewerkingen toepassen")
        gbl = QVBoxLayout(gb)
        self._b_exif    = QCheckBox("EXIF verwijderen"); self._b_exif.setChecked(True)
        self._b_enhance = QCheckBox("Auto verbetering toepassen")
        self._b_wm      = QCheckBox("Watermerk toepassen (huidige instelling)")
        self._b_face    = QCheckBox("Gezichtsdetectie waarschuwing")
        for c in (self._b_exif, self._b_enhance, self._b_wm, self._b_face):
            gbl.addWidget(c)
        lay.addWidget(gb)

        # Export
        ge = QGroupBox("📤  Export")
        gel = QVBoxLayout(ge)
        pr = QHBoxLayout(); pr.addWidget(QLabel("Platform:"))
        self._b_platform = QComboBox(); self._b_platform.addItems(PLATFORM_NAMES)
        pr.addWidget(self._b_platform); gel.addLayout(pr)

        fr = QHBoxLayout(); fr.addWidget(QLabel("Formaat:"))
        self._b_fmt = QComboBox(); self._b_fmt.addItems(["JPEG","PNG","WebP"]); fr.addWidget(self._b_fmt); gel.addLayout(fr)

        self._b_anon = QCheckBox("Anonieme bestandsnamen (UUID)"); self._b_anon.setChecked(True); gel.addWidget(self._b_anon)

        self._batch_out = QLineEdit(); self._batch_out.setReadOnly(True)
        self._batch_out.setText(str(Path.home() / "klaar_voor_upload"))
        gel.addWidget(self._batch_out)
        bo = QPushButton("📂  Uitvoermap kiezen…"); bo.clicked.connect(self._pick_batch_out); gel.addWidget(bo)
        lay.addWidget(ge)

        self._batch_pb = QProgressBar(); self._batch_pb.setVisible(False); lay.addWidget(self._batch_pb)

        btn_batch = QPushButton("🚀  Batch verwerken")
        btn_batch.setStyleSheet("QPushButton{background:#1a6edc;padding:10px;font-weight:bold;}")
        btn_batch.clicked.connect(self._run_batch)
        lay.addWidget(btn_batch)

        self._batch_log = QTextEdit(); self._batch_log.setReadOnly(True); self._batch_log.setMaximumHeight(120)
        lay.addWidget(self._batch_log)

        lay.addStretch()
        return sc

    # ── Presets tab ───────────────────────────────────────────

    def _tab_presets(self) -> QScrollArea:
        sc, lay = self._scroll()

        g = QGroupBox("⭐  Presets")
        gl = QVBoxLayout(g)
        gl.addWidget(self._note("Sla je huidige instellingen op als preset om later snel te hergebruiken."))

        nr = QHBoxLayout(); nr.addWidget(QLabel("Naam:"))
        self._preset_name = QLineEdit(); self._preset_name.setPlaceholderText("Bijv. Standaard Watermerk")
        nr.addWidget(self._preset_name); gl.addLayout(nr)

        bs = QPushButton("💾  Opslaan als preset")
        bs.clicked.connect(self._save_preset); gl.addWidget(bs)

        sep = QFrame(); sep.setFrameShape(QFrame.Shape.HLine); gl.addWidget(sep)
        gl.addWidget(QLabel("Opgeslagen presets:"))

        self._preset_list = QListWidget(); self._preset_list.setMaximumHeight(140)
        gl.addWidget(self._preset_list)
        self._refresh_presets()

        row2 = QHBoxLayout()
        bl = QPushButton("📂  Laden");   bl.clicked.connect(self._load_preset)
        bd = QPushButton("🗑  Verwijderen"); bd.clicked.connect(self._delete_preset)
        row2.addWidget(bl); row2.addWidget(bd); gl.addLayout(row2)
        lay.addWidget(g)

        lay.addStretch()
        return sc

    # ── AI Foto tab ───────────────────────────────────────────

    def _tab_ai(self) -> QScrollArea:
        sc, lay = self._scroll()

        gk = QGroupBox("🔑  API Sleutel")
        kl = QVBoxLayout(gk)
        self._api_key = QLineEdit(); self._api_key.setPlaceholderText("sk-ant-…"); self._api_key.setEchoMode(QLineEdit.EchoMode.Password)
        kl.addWidget(self._api_key)
        krow = QHBoxLayout()
        bsk = QPushButton("💾  Opslaan"); bsk.clicked.connect(self._save_key); krow.addWidget(bsk)
        self._key_status = QLabel("")
        self._key_status.setStyleSheet("color:#2ecc71;font-size:12px;font-weight:bold;")
        krow.addWidget(self._key_status); krow.addStretch(); kl.addLayout(krow)
        lay.addWidget(gk)

        self._btn_gen = QPushButton("🤖  Genereer beschrijving + hashtags")
        self._btn_gen.setStyleSheet("QPushButton{background:#e67e22;color:white;padding:12px;font-size:13px;font-weight:bold;border-radius:5px;}QPushButton:hover{background:#cf6d17;}QPushButton:disabled{background:#555;color:#888;}")
        self._btn_gen.clicked.connect(self._run_ai)
        lay.addWidget(self._btn_gen)

        self._ai_status = QLabel("Laad een foto en klik op de knop hierboven.")
        self._ai_status.setAlignment(Qt.AlignmentFlag.AlignCenter); self._ai_status.setStyleSheet("color:#aaa;font-size:11px;"); self._ai_status.setWordWrap(True)
        lay.addWidget(self._ai_status)

        gc = QGroupBox("📝  Beschrijving")
        gcl = QVBoxLayout(gc)
        self._caption = QTextEdit(); self._caption.setPlaceholderText("Verschijnt hier…"); self._caption.setMinimumHeight(80); self._caption.setMaximumHeight(140)
        gcl.addWidget(self._caption)
        bcc = QPushButton("📋  Kopieer"); bcc.clicked.connect(lambda: self._clip(self._caption.toPlainText())); gcl.addWidget(bcc)
        lay.addWidget(gc)

        gh = QGroupBox("#  Hashtags")
        ghl = QVBoxLayout(gh)
        self._hashtags = QTextEdit(); self._hashtags.setPlaceholderText("Verschijnt hier…"); self._hashtags.setMinimumHeight(60); self._hashtags.setMaximumHeight(110)
        ghl.addWidget(self._hashtags)
        bch = QPushButton("📋  Kopieer"); bch.clicked.connect(lambda: self._clip(self._hashtags.toPlainText())); ghl.addWidget(bch)
        lay.addWidget(gh)

        lay.addStretch()
        return sc

    # ── AI Tools tab ──────────────────────────────────────────

    def _tab_ai_tools(self) -> QScrollArea:
        sc, lay = self._scroll()

        # Titels
        gt = QGroupBox("🏷  Titels genereren")
        gtl = QVBoxLayout(gt)
        pr = QHBoxLayout(); pr.addWidget(QLabel("Platform:"))
        self._title_plat = QComboBox(); self._title_plat.addItems(["Algemeen","FeetFinder","Etsy","OnlyFans","Instagram"]); pr.addWidget(self._title_plat); gtl.addLayout(pr)
        self._btn_title = QPushButton("🏷  Genereer 5 titels"); self._btn_title.clicked.connect(self._run_title)
        self._btn_title.setStyleSheet("QPushButton{background:#e67e22;padding:8px;}")
        gtl.addWidget(self._btn_title)
        self._title_out = QTextEdit(); self._title_out.setReadOnly(True); self._title_out.setMaximumHeight(100)
        gtl.addWidget(self._title_out)
        bct = QPushButton("📋  Kopieer"); bct.clicked.connect(lambda: self._clip(self._title_out.toPlainText())); gtl.addWidget(bct)
        lay.addWidget(gt)

        # Sessie-ideeën
        gi = QGroupBox("💡  Sessie-ideeën")
        gil = QVBoxLayout(gi)
        ir = QHBoxLayout(); ir.addWidget(QLabel("Platform:"))
        self._ideas_plat = QComboBox(); self._ideas_plat.addItems(["FeetFinder","Etsy","OnlyFans","Instagram","Algemeen"]); ir.addWidget(self._ideas_plat); gil.addLayout(ir)
        self._ideas_thema = QLineEdit(); self._ideas_thema.setPlaceholderText("Thema (bijv. zomer, luxe, sport)…"); gil.addWidget(self._ideas_thema)
        anr = QHBoxLayout(); anr.addWidget(QLabel("Aantal:"))
        self._ideas_count = QSpinBox(); self._ideas_count.setRange(5,20); self._ideas_count.setValue(10); anr.addWidget(self._ideas_count); anr.addStretch(); gil.addLayout(anr)
        self._btn_ideas = QPushButton("💡  Genereer ideeën"); self._btn_ideas.clicked.connect(self._run_ideas)
        self._btn_ideas.setStyleSheet("QPushButton{background:#e67e22;padding:8px;}")
        gil.addWidget(self._btn_ideas)
        self._ideas_out = QTextEdit(); self._ideas_out.setReadOnly(True); self._ideas_out.setMinimumHeight(90); self._ideas_out.setMaximumHeight(150)
        gil.addWidget(self._ideas_out)
        bci = QPushButton("📋  Kopieer"); bci.clicked.connect(lambda: self._clip(self._ideas_out.toPlainText())); gil.addWidget(bci)
        lay.addWidget(gi)

        # Antwoordtemplates
        gr = QGroupBox("💬  Klantreactie templates")
        grl = QVBoxLayout(gr)
        self._reply_sit = QComboBox(); self._reply_sit.addItems(ReplyTemplateWorker.SITUATIES + ["Aangepast…"]); grl.addWidget(self._reply_sit)
        self._reply_custom = QLineEdit(); self._reply_custom.setPlaceholderText("Beschrijf de situatie…"); self._reply_custom.setVisible(False); grl.addWidget(self._reply_custom)
        self._reply_sit.currentIndexChanged.connect(lambda i: self._reply_custom.setVisible(i == len(ReplyTemplateWorker.SITUATIES)))
        tr = QHBoxLayout(); tr.addWidget(QLabel("Toon:"))
        self._reply_toon = QComboBox(); self._reply_toon.addItems(["Vriendelijk professioneel","Formeel","Casual","Enthousiast"]); tr.addWidget(self._reply_toon); grl.addLayout(tr)
        self._btn_reply = QPushButton("💬  Genereer templates"); self._btn_reply.clicked.connect(self._run_reply)
        self._btn_reply.setStyleSheet("QPushButton{background:#e67e22;padding:8px;}")
        grl.addWidget(self._btn_reply)
        self._reply_out = QTextEdit(); self._reply_out.setReadOnly(True); self._reply_out.setMinimumHeight(100); self._reply_out.setMaximumHeight(160)
        grl.addWidget(self._reply_out)
        bcr = QPushButton("📋  Kopieer"); bcr.clicked.connect(lambda: self._clip(self._reply_out.toPlainText())); grl.addWidget(bcr)
        lay.addWidget(gr)

        lay.addStretch()
        return sc

    # ── Export tab ────────────────────────────────────────────

    def _tab_export(self) -> QScrollArea:
        sc, lay = self._scroll()

        gf = QGroupBox("📁  Uitvoermap")
        gfl = QVBoxLayout(gf)
        self._out_folder = QLineEdit(str(Path.home() / "klaar_voor_upload")); self._out_folder.setReadOnly(True)
        gfl.addWidget(self._out_folder)
        row = QHBoxLayout()
        bb = QPushButton("📂  Kiezen…"); bb.clicked.connect(self._choose_folder)
        bo2 = QPushButton("📂  Openen"); bo2.clicked.connect(self._open_folder)
        row.addWidget(bb); row.addWidget(bo2); gfl.addLayout(row)
        lay.addWidget(gf)

        gn = QGroupBox("📄  Bestandsnamen")
        gnl = QVBoxLayout(gn)
        self._chk_anon = QCheckBox("Anonimiseren (UUID bestandsnamen)"); self._chk_anon.setChecked(True); gnl.addWidget(self._chk_anon)
        pr2 = QHBoxLayout(); pr2.addWidget(QLabel("Prefix:"))
        self._prefix = QLineEdit("product_"); self._prefix.setMaximumWidth(140); pr2.addWidget(self._prefix); pr2.addStretch(); gnl.addLayout(pr2)
        fr = QHBoxLayout(); fr.addWidget(QLabel("Formaat:"))
        self._fmt = QComboBox(); self._fmt.addItems(["JPEG","PNG","WebP"]); fr.addWidget(self._fmt); fr.addStretch(); gnl.addLayout(fr)
        qr = QHBoxLayout(); qr.addWidget(QLabel("Kwaliteit:"))
        self._quality = QSlider(Qt.Orientation.Horizontal); self._quality.setRange(60,100); self._quality.setValue(90)
        self._qual_lbl = QLabel("90"); self._quality.valueChanged.connect(lambda v: self._qual_lbl.setText(str(v)))
        qr.addWidget(self._quality); qr.addWidget(self._qual_lbl); gnl.addLayout(qr)
        lay.addWidget(gn)

        bc = QPushButton("💾  Huidige foto exporteren")
        bc.setStyleSheet("QPushButton{background:#196c40;padding:9px;font-weight:bold;}"); bc.clicked.connect(self._export_current); lay.addWidget(bc)

        ba = QPushButton("📦  Alle foto's exporteren")
        ba.setStyleSheet("QPushButton{background:#1a6edc;padding:9px;font-weight:bold;}"); ba.clicked.connect(self._export_all); lay.addWidget(ba)

        self._exp_log = QTextEdit(); self._exp_log.setReadOnly(True); self._exp_log.setMaximumHeight(110); self._exp_log.setPlaceholderText("Exportlog…")
        lay.addWidget(self._exp_log)

        lay.addStretch()
        return sc

    # ── Business tab ──────────────────────────────────────────

    def _tab_business(self) -> QWidget:
        inner = QTabWidget()
        inner.addTab(self._tab_income(),  "💰 Inkomsten")
        inner.addTab(self._tab_orders(),  "📦 Bestellingen")
        inner.addTab(self._tab_prices(),  "💲 Prijzen")
        return inner

    def _tab_income(self) -> QScrollArea:
        sc, lay = self._scroll()

        ga = QGroupBox("➕  Inkomst toevoegen")
        gal = QVBoxLayout(ga)

        pr = QHBoxLayout(); pr.addWidget(QLabel("Platform:"))
        self._inc_plat = QComboBox(); self._inc_plat.addItems(["FeetFinder","Etsy","OnlyFans","Anders"]); self._inc_plat.setEditable(True)
        pr.addWidget(self._inc_plat); gal.addLayout(pr)

        dr = QHBoxLayout(); dr.addWidget(QLabel("Datum:"))
        self._inc_date = QDateEdit(QDate.currentDate()); self._inc_date.setCalendarPopup(True); self._inc_date.setDisplayFormat("dd-MM-yyyy")
        dr.addWidget(self._inc_date); gal.addLayout(dr)

        ar = QHBoxLayout(); ar.addWidget(QLabel("Bedrag (€):"))
        self._inc_amt = QDoubleSpinBox(); self._inc_amt.setRange(0.01,99999.99); self._inc_amt.setDecimals(2); self._inc_amt.setValue(10.0)
        ar.addWidget(self._inc_amt); gal.addLayout(ar)

        self._inc_desc = QLineEdit(); self._inc_desc.setPlaceholderText("Omschrijving (optioneel)"); gal.addWidget(self._inc_desc)

        badd = QPushButton("➕  Toevoegen"); badd.setStyleSheet("QPushButton{background:#196c40;padding:7px;}"); badd.clicked.connect(self._add_income); gal.addWidget(badd)
        lay.addWidget(ga)

        go = QGroupBox("📊  Overzicht")
        gol = QVBoxLayout(go)
        self._inc_total = QLabel("Totaal: € 0.00")
        self._inc_total.setStyleSheet("font-size:14px;font-weight:bold;color:#2ecc71;"); gol.addWidget(self._inc_total)
        self._inc_table = QTableWidget(0, 4)
        self._inc_table.setHorizontalHeaderLabels(["Platform","Datum","€ Bedrag","Omschrijving"])
        self._inc_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self._inc_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._inc_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        gol.addWidget(self._inc_table)
        bdel = QPushButton("🗑  Verwijder geselecteerde"); bdel.clicked.connect(self._del_income); gol.addWidget(bdel)
        lay.addWidget(go)
        self._refresh_income()

        lay.addStretch()
        return sc

    def _tab_orders(self) -> QScrollArea:
        sc, lay = self._scroll()

        ga = QGroupBox("➕  Nieuwe bestelling")
        gal = QVBoxLayout(ga)
        self._ord_klant = QLineEdit(); self._ord_klant.setPlaceholderText("Klantnaam / alias"); gal.addWidget(self._ord_klant)
        pr = QHBoxLayout(); pr.addWidget(QLabel("Platform:"))
        self._ord_plat = QComboBox(); self._ord_plat.addItems(["FeetFinder","Etsy","OnlyFans","DM","Anders"]); self._ord_plat.setEditable(True)
        pr.addWidget(self._ord_plat); gal.addLayout(pr)
        self._ord_desc = QLineEdit(); self._ord_desc.setPlaceholderText("Beschrijving / aanvraag"); gal.addWidget(self._ord_desc)
        ar = QHBoxLayout(); ar.addWidget(QLabel("Prijs (€):"))
        self._ord_price = QDoubleSpinBox(); self._ord_price.setRange(0,9999); self._ord_price.setDecimals(2); self._ord_price.setValue(25.0)
        ar.addWidget(self._ord_price); gal.addLayout(ar)
        sr = QHBoxLayout(); sr.addWidget(QLabel("Status:"))
        self._ord_status = QComboBox(); self._ord_status.addItems(OrderManager.STATUSSEN); sr.addWidget(self._ord_status); gal.addLayout(sr)
        badd = QPushButton("➕  Toevoegen"); badd.setStyleSheet("QPushButton{background:#196c40;padding:7px;}"); badd.clicked.connect(self._add_order); gal.addWidget(badd)
        lay.addWidget(ga)

        go = QGroupBox("📋  Bestellingen")
        gol = QVBoxLayout(go)
        self._ord_table = QTableWidget(0, 6)
        self._ord_table.setHorizontalHeaderLabels(["Klant","Platform","Beschrijving","€","Status","Datum"])
        self._ord_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self._ord_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._ord_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        gol.addWidget(self._ord_table)
        row = QHBoxLayout()
        bus = QPushButton("✏  Status wijzigen"); bus.clicked.connect(self._update_order_status)
        bdel = QPushButton("🗑  Verwijderen"); bdel.clicked.connect(self._del_order)
        row.addWidget(bus); row.addWidget(bdel); gol.addLayout(row)
        lay.addWidget(go)
        self._refresh_orders()

        lay.addStretch()
        return sc

    def _tab_prices(self) -> QScrollArea:
        sc, lay = self._scroll()

        g = QGroupBox("💲  Prijscalculator")
        gl = QVBoxLayout(g)

        for lbl, attr, lo, hi, default, step, dec in [
            ("Basisprijs per foto (€):", "_pc_base",  1.0,  999.0, 15.0, 0.5, 2),
            ("Aantal foto's:",           "_pc_count",  1,    999,   5,    1,   0),
            ("Bundelkorting (%):",        "_pc_disc",   0.0,  80.0,  10.0, 5,   1),
        ]:
            row = QHBoxLayout(); row.addWidget(QLabel(lbl))
            if dec > 0:
                sp = QDoubleSpinBox(); sp.setRange(lo, hi); sp.setValue(default); sp.setSingleStep(step); sp.setDecimals(dec)
            else:
                sp = QSpinBox(); sp.setRange(int(lo), int(hi)); sp.setValue(int(default)); sp.setSingleStep(int(step))
            setattr(self, attr, sp); row.addWidget(sp); gl.addLayout(row)

        bcalc = QPushButton("🧮  Bereken")
        bcalc.setStyleSheet("QPushButton{background:#196c40;padding:8px;}")
        bcalc.clicked.connect(self._calc_price)
        gl.addWidget(bcalc)

        self._price_result = QLabel("")
        self._price_result.setStyleSheet("font-size:13px;font-weight:bold;color:#2ecc71;padding:6px;")
        self._price_result.setWordWrap(True)
        gl.addWidget(self._price_result)
        lay.addWidget(g)

        # Platform suggesties
        gs = QGroupBox("💡  Platform suggesties")
        gsl = QVBoxLayout(gs)
        gsl.addWidget(self._note(
            "FeetFinder: €5–€30/foto, bundles €20–€150\n"
            "Etsy: €5–€25/digitale foto\n"
            "OnlyFans: €10–€50/custom set\n"
            "Tip: exclusieve content = hogere prijs"
        ))
        lay.addWidget(gs)

        lay.addStretch()
        return sc

    # ── Backup tab ────────────────────────────────────────────

    def _tab_backup(self) -> QScrollArea:
        sc, lay = self._scroll()

        gm = QGroupBox("🔐  Backup maken (versleuteld)")
        gml = QVBoxLayout(gm)
        gml.addWidget(self._note(
            "Maakt een AES-versleuteld backup-archief van al je\n"
            "presets, inkomsten en bestellingen.\n"
            "Sleutelbestand: ~/feetbusiness_data/.backup_key\n"
            "Bewaar dit bestand op een veilige plek!"
        ))
        self._bkp_out = QLineEdit()
        self._bkp_out.setPlaceholderText("Backup bestandslocatie…"); self._bkp_out.setReadOnly(True)
        self._bkp_out.setText(str(Path.home() / f"backup_{datetime.now().strftime('%Y%m%d')}.enc"))
        gml.addWidget(self._bkp_out)
        bb = QPushButton("📂  Locatie kiezen…"); bb.clicked.connect(self._pick_backup_out); gml.addWidget(bb)
        bcr = QPushButton("🔐  Backup maken")
        bcr.setStyleSheet("QPushButton{background:#c0392b;padding:8px;}"); bcr.clicked.connect(self._create_backup); gml.addWidget(bcr)
        lay.addWidget(gm)

        gr = QGroupBox("🔓  Backup herstellen")
        grl = QVBoxLayout(gr)
        self._bkp_in = QLineEdit(); self._bkp_in.setReadOnly(True); self._bkp_in.setPlaceholderText("Backup bestand (.enc)")
        grl.addWidget(self._bkp_in)
        bb2 = QPushButton("📂  Backup kiezen…"); bb2.clicked.connect(self._pick_backup_in); grl.addWidget(bb2)
        self._bkp_restore_dir = QLineEdit(); self._bkp_restore_dir.setReadOnly(True)
        self._bkp_restore_dir.setText(str(Path.home() / "feetbusiness_restore"))
        grl.addWidget(self._bkp_restore_dir)
        bb3 = QPushButton("📂  Herstelmap kiezen…"); bb3.clicked.connect(self._pick_restore_dir); grl.addWidget(bb3)
        brs = QPushButton("🔓  Herstellen"); brs.setStyleSheet("QPushButton{background:#6f42c1;padding:8px;}"); brs.clicked.connect(self._restore_backup); grl.addWidget(brs)
        lay.addWidget(gr)

        self._bkp_status = QLabel("")
        self._bkp_status.setStyleSheet("color:#aaa;font-size:11px;"); self._bkp_status.setWordWrap(True)
        lay.addWidget(self._bkp_status)

        lay.addStretch()
        return sc

    # ── Menu & Toolbar ────────────────────────────────────────

    def _build_menu(self):
        mb = self.menuBar()
        fm = mb.addMenu("Bestand")
        self._act(fm, "📂  Openen…",       "Ctrl+O",       self._open_files)
        fm.addSeparator()
        self._act(fm, "💾  Huidig opslaan", "Ctrl+S",       self._export_current)
        self._act(fm, "📦  Alles exporteren","Ctrl+Shift+S", self._export_all)
        fm.addSeparator()
        self._act(fm, "Afsluiten",          "Ctrl+Q",       self.close)
        em = mb.addMenu("Bewerken")
        self._act(em, "↺  Origineel",       "Ctrl+Z",       self._reset_image)
        self._act(em, "🗑  EXIF verwijderen","",             self._remove_exif)

    def _act(self, menu, lbl, shortcut, fn):
        a = QAction(lbl, self)
        if shortcut: a.setShortcut(shortcut)
        a.triggered.connect(fn)
        menu.addAction(a)

    def _build_toolbar(self):
        tb = self.addToolBar("Hoofd"); tb.setMovable(False)
        tb.setStyleSheet("QToolBar{background:#2a2a2a;border-bottom:1px solid #444;padding:3px;}")
        for lbl, fn in [
            ("📂 Openen", self._open_files),
            ("💾 Opslaan", self._export_current),
            ("📦 Alles", self._export_all),
            ("🗑 EXIF", self._remove_exif),
            ("↺ Origineel", self._reset_image),
            ("🤖 AI", self._run_ai),
        ]:
            b = QPushButton(lbl); b.setFixedHeight(30); b.clicked.connect(fn); tb.addWidget(b)

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow,QWidget{background:#1e1e1e;color:#e0e0e0;}
            QGroupBox{border:1px solid #444;border-radius:5px;margin-top:10px;padding-top:8px;font-weight:bold;}
            QGroupBox::title{subcontrol-origin:margin;left:10px;padding:0 4px;}
            QPushButton{background:#333;color:#e0e0e0;border:1px solid #555;border-radius:4px;padding:5px 10px;min-height:24px;}
            QPushButton:hover{background:#444;border-color:#888;}
            QPushButton:pressed{background:#222;}
            QPushButton:checked{background:#1a6edc;border-color:#0d5bbb;}
            QPushButton:disabled{background:#2a2a2a;color:#666;}
            QLineEdit,QTextEdit,QSpinBox,QDoubleSpinBox,QComboBox,QDateEdit{background:#2d2d2d;color:#e0e0e0;border:1px solid #555;border-radius:3px;padding:3px;}
            QSlider::groove:horizontal{background:#444;height:6px;border-radius:3px;}
            QSlider::handle:horizontal{background:#1a6edc;width:14px;height:14px;border-radius:7px;margin:-4px 0;}
            QTabWidget::pane{border:1px solid #444;background:#1e1e1e;}
            QTabBar::tab{background:#2a2a2a;color:#aaa;padding:5px 9px;border:1px solid #444;font-size:11px;}
            QTabBar::tab:selected{background:#1e1e1e;color:#e0e0e0;border-bottom:none;}
            QListWidget{background:#1a1a1a;border:1px solid #444;}
            QListWidget::item{padding:5px;border-bottom:1px solid #2a2a2a;}
            QListWidget::item:selected{background:#1a6edc;}
            QListWidget::item:hover{background:#2a2a2a;}
            QTableWidget{background:#1a1a1a;gridline-color:#333;}
            QTableWidget::item:selected{background:#1a6edc;}
            QHeaderView::section{background:#2a2a2a;border:1px solid #444;padding:4px;}
            QScrollArea{border:none;background:transparent;}
            QSplitter::handle{background:#3a3a3a;}
            QStatusBar{background:#2a2a2a;color:#aaa;}
            QMenuBar{background:#2a2a2a;color:#e0e0e0;}
            QMenuBar::item:selected{background:#444;}
            QMenu{background:#2a2a2a;color:#e0e0e0;border:1px solid #555;}
            QMenu::item:selected{background:#1a6edc;}
            QCheckBox,QLabel{color:#e0e0e0;}
            QProgressBar{background:#333;border:1px solid #555;border-radius:3px;text-align:center;}
            QProgressBar::chunk{background:#1a6edc;}
        """)

    def _load_settings(self):
        env_key  = os.environ.get("ANTHROPIC_API_KEY", "")
        sav_key  = self._settings.value("api_key", "")
        key = env_key or sav_key
        if key:
            self._api_key.setText(key)
            self._key_status.setText("✓  Geladen")
        folder = self._settings.value("export_folder", str(Path.home() / "klaar_voor_upload"))
        self._out_folder.setText(folder)

    # ══════════════════════════════════════════════════════════
    # EVENT HANDLERS
    # ══════════════════════════════════════════════════════════

    # ── Bestandsbeheer ────────────────────────────────────────

    def _open_files(self):
        files, _ = QFileDialog.getOpenFileNames(
            self, "Foto's selecteren", str(Path.home()),
            "Afbeeldingen (*.jpg *.jpeg *.png *.gif *.webp *.bmp *.tiff *.tif)"
        )
        if files: self._add_files(files)

    def _add_files(self, paths: list[str]):
        for p in paths:
            if p not in self._file_list and os.path.isfile(p):
                self._file_list.append(p)
                item = QListWidgetItem(Path(p).name)
                item.setData(Qt.ItemDataRole.UserRole, p)
                item.setToolTip(p)
                self._flist.addItem(item)
        self._fcount.setText(f"{len(self._file_list)} foto's geladen")
        if self._flist.currentItem() is None and self._flist.count():
            self._flist.setCurrentRow(0)
            self._file_clicked(self._flist.item(0))

    def _clear_list(self):
        self._file_list.clear(); self._flist.clear(); self._fcount.setText("0 foto's"); self._current_path = None

    def _list_drop(self, event):
        files = [u.toLocalFile() for u in event.mimeData().urls()
                 if u.toLocalFile().lower().endswith((".jpg",".jpeg",".png",".gif",".webp",".bmp",".tiff",".tif"))]
        if files: self._add_files(files)
        event.acceptProposedAction()

    def _load_file(self, path: str):
        if path not in self._file_list:
            self._add_files([path])
        for i in range(self._flist.count()):
            item = self._flist.item(i)
            if item.data(Qt.ItemDataRole.UserRole) == path:
                self._flist.setCurrentItem(item); self._file_clicked(item); break

    def _file_clicked(self, item: QListWidgetItem):
        path = item.data(Qt.ItemDataRole.UserRole)
        if not path or not os.path.isfile(path): return
        try:
            img = normalize_image_mode(Image.open(path))
            self.canvas.load_image(img)
            self._current_path = path
            self._update_info()
            self._status.showMessage(f"Geladen: {path}")
            self._caption.clear(); self._hashtags.clear()
            self._ai_status.setText("Klik op '🤖 Genereer' voor analyse.")
        except Exception as exc:
            QMessageBox.warning(self, "Laadifout", str(exc))

    def _canvas_changed(self): self._update_info()

    def _update_info(self):
        if self.canvas.working_image:
            iw, ih = self.canvas.working_image.size
            n = Path(self._current_path).name if self._current_path else ""
            self._img_info.setText(f"{n}  {iw}×{ih} px")

    # ── Gereedschappen ────────────────────────────────────────

    def _set_tool(self, tool: str | None):
        self.canvas.active_tool = tool
        self._btn_no_tool.setChecked(tool is None)
        self._btn_blur_tool.setChecked(tool == "blur")
        cur = Qt.CursorShape.CrossCursor if tool == "blur" else Qt.CursorShape.ArrowCursor
        self.canvas.setCursor(cur)
        msgs = {"blur": "🌫  Blur Tool — sleep over het gebied", None: "Gereed"}
        self._status.showMessage(msgs.get(tool, "Gereed"))

    def _remove_exif(self):
        if self.canvas.working_image is None: return self._status.showMessage("⚠ Geen foto geladen")
        self.canvas.remove_exif(); self._status.showMessage("✓  EXIF verwijderd")

    def _margin_changed(self):
        self.canvas.crop_margins = {k: s.value() for k, s in self._mspins.items()}
        if self._chk_crop_prev.isChecked(): self.canvas.show_crop_preview = True; self.canvas.refresh_display()

    def _toggle_crop_prev(self, on: bool):
        self.canvas.show_crop_preview = on; self.canvas.refresh_display()

    def _apply_crop(self):
        if self.canvas.working_image is None: return
        m = {k: s.value() for k, s in self._mspins.items()}
        iw, ih = self.canvas.working_image.size
        if m["left"]+m["right"] >= iw or m["top"]+m["bottom"] >= ih:
            return QMessageBox.warning(self, "Bijsnijden", "Marges te groot!")
        self.canvas.show_crop_preview = False; self._chk_crop_prev.setChecked(False)
        self.canvas.apply_crop(m)
        for s in self._mspins.values(): s.setValue(0)
        self._status.showMessage("✓  Bijgesneden")

    def _apply_enhance(self):
        if self.canvas.working_image is None: return self._status.showMessage("⚠ Geen foto geladen")
        vals = {k: self._enh_sliders[k].value() / 100 for k in self._enh_sliders}
        self.canvas.apply_enhancement(**vals)
        self._status.showMessage("✓  Verbetering toegepast")

    def _reset_enh_sliders(self):
        for sl in self._enh_sliders.values(): sl.setValue(100)

    def _check_faces(self):
        if self.canvas.working_image is None:
            return self._face_result.setText("⚠ Geen foto geladen")
        self._face_result.setText("⏳ Bezig met scannen…")
        QApplication.processEvents()
        faces = detect_faces(self.canvas.working_image)
        if faces:
            self._face_result.setText(f"⚠  {len(faces)} gezicht(en) gedetecteerd!")
            self._face_result.setStyleSheet("color:#e74c3c;font-size:12px;font-weight:bold;padding:4px;")
        else:
            self._face_result.setText("✓  Geen gezichten gevonden")
            self._face_result.setStyleSheet("color:#2ecc71;font-size:12px;padding:4px;")

    def _apply_platform(self):
        if self.canvas.working_image is None: return self._status.showMessage("⚠ Geen foto geladen")
        plat = self._platform_combo.currentText()
        if plat == "Geen aanpassing": return
        self.canvas.apply_platform_resize(plat)
        self._status.showMessage(f"✓  Aangepast voor {plat}")

    # ── Watermerk ─────────────────────────────────────────────

    def _wm_type_changed(self, idx: int):
        self._wm_txt_grp.setVisible(idx == 0); self._wm_logo_grp.setVisible(idx == 1)

    def _pick_color(self):
        c = QColorDialog.getColor(QColor(*self._wm_color), self)
        if c.isValid():
            self._wm_color = (c.red(), c.green(), c.blue())
            self._wm_clr_btn.setStyleSheet(f"background:{c.name()};")

    def _pick_logo(self):
        f, _ = QFileDialog.getOpenFileName(self, "Logo kiezen", str(Path.home()), "Afbeeldingen (*.png *.jpg *.jpeg *.gif *.webp)")
        if f: self._wm_logo_path.setText(f)

    def _build_wm_settings(self) -> dict:
        """Bouw de watermerk-instellingen dict vanuit de huidige UI-waarden."""
        pos = POSITION_KEYS[self._wm_pos.currentIndex()]
        op  = self._wm_opacity.value()
        if self._wm_type.currentIndex() == 0:
            return {"type": "text", "text": self._wm_text.text(),
                    "font_size": self._wm_fsize.value(), "opacity": op,
                    "position": pos, "color": self._wm_color}
        return {"type": "logo", "logo_path": self._wm_logo_path.text(),
                "logo_size": self._wm_logo_size.value(), "opacity": op, "position": pos}

    def _apply_watermark(self):
        if self.canvas.working_image is None: return self._status.showMessage("⚠ Geen foto geladen")
        self.canvas.apply_watermark(self._build_wm_settings())
        self._status.showMessage("✓  Watermerk toegepast")

    def _reset_image(self):
        self.canvas.reset_to_original(); self._status.showMessage("↺  Origineel hersteld")

    # ── Presets ───────────────────────────────────────────────

    def _current_preset_settings(self) -> dict:
        return {
            "wm_type":      self._wm_type.currentIndex(),
            "wm_text":      self._wm_text.text(),
            "wm_fsize":     self._wm_fsize.value(),
            "wm_opacity":   self._wm_opacity.value(),
            "wm_position":  POSITION_KEYS[min(self._wm_pos.currentIndex(), len(POSITION_KEYS)-1)],
            "wm_color":     list(self._wm_color),
            "enh_brightness": self._enh_sliders["brightness"].value(),
            "enh_contrast":   self._enh_sliders["contrast"].value(),
            "enh_color":      self._enh_sliders["color"].value(),
            "enh_sharpness":  self._enh_sliders["sharpness"].value(),
            "export_format":  self._fmt.currentText(),
            "export_quality": self._quality.value(),
        }

    def _apply_preset_settings(self, s: dict):
        self._wm_type.setCurrentIndex(s.get("wm_type", 0))
        self._wm_text.setText(s.get("wm_text", ""))
        self._wm_fsize.setValue(s.get("wm_fsize", 40))
        self._wm_opacity.setValue(s.get("wm_opacity", 180))
        c = s.get("wm_color", [255,255,255])
        self._wm_color = tuple(c)
        self._wm_clr_btn.setStyleSheet(f"background:rgb({c[0]},{c[1]},{c[2]});")
        for key in ("brightness","contrast","color","sharpness"):
            v = s.get(f"enh_{key}", 100)
            self._enh_sliders[key].setValue(v)
        if s.get("export_format"):
            idx = self._fmt.findText(s["export_format"])
            if idx >= 0: self._fmt.setCurrentIndex(idx)
        if s.get("export_quality"):
            self._quality.setValue(s["export_quality"])

    def _save_preset(self):
        name = self._preset_name.text().strip()
        if not name:
            name, ok = QInputDialog.getText(self, "Preset naam", "Naam:")
            if not ok or not name: return
        self._preset_mgr.save_preset(name, self._current_preset_settings())
        self._refresh_presets(); self._status.showMessage(f"✓  Preset '{name}' opgeslagen")

    def _load_preset(self):
        item = self._preset_list.currentItem()
        if not item: return
        try:
            s = self._preset_mgr.load_preset(item.text())
            self._apply_preset_settings(s)
            self._status.showMessage(f"✓  Preset '{item.text()}' geladen")
        except Exception as exc:
            QMessageBox.warning(self, "Fout", str(exc))

    def _delete_preset(self):
        item = self._preset_list.currentItem()
        if not item: return
        self._preset_mgr.delete_preset(item.text())
        self._refresh_presets(); self._status.showMessage(f"✓  Preset verwijderd")

    def _refresh_presets(self):
        self._preset_list.clear()
        for name in self._preset_mgr.list_presets():
            self._preset_list.addItem(name)

    # ── Claude AI ─────────────────────────────────────────────

    def _save_key(self):
        key = self._api_key.text().strip()
        if key:
            self._settings.setValue("api_key", key)
            self._key_status.setText("✓  Opgeslagen")
            self._key_status.setStyleSheet("color:#2ecc71;font-size:12px;font-weight:bold;")
            self._status.showMessage("✓  API sleutel opgeslagen")
        else:
            self._key_status.setText("⚠  Geen sleutel")
            self._key_status.setStyleSheet("color:#e74c3c;font-size:12px;")

    def _get_key(self) -> str:
        return self._api_key.text().strip() or self._settings.value("api_key","") or os.environ.get("ANTHROPIC_API_KEY","")

    def _img_bytes(self) -> bytes | None:
        img = self.canvas.working_image
        if img is None: return None
        img = img.copy()
        if img.mode not in ("RGB","L"): img = img.convert("RGB")
        img.thumbnail((1500,1500), Image.LANCZOS)
        buf = io.BytesIO(); img.save(buf, "JPEG", quality=85); return buf.getvalue()

    def _run_ai(self):
        if self.canvas.working_image is None:
            return QMessageBox.information(self, "Geen foto", "Laad eerst een foto.")
        key = self._get_key()
        if not key:
            return QMessageBox.warning(self, "API sleutel ontbreekt", "Voer een Anthropic API sleutel in op het 🤖 AI Foto tabblad.")
        bts = self._img_bytes()
        if bts is None: return
        self._btn_gen.setEnabled(False); self._ai_status.setText("⏳ Analyseren…")
        self._pb.setVisible(True); self._pb.setRange(0,0)
        self._ai_worker = ClaudeWorker(key, bts)
        self._ai_worker.result_ready.connect(self._ai_done)
        self._ai_worker.error_occurred.connect(self._ai_err)
        self._ai_worker.progress.connect(self._ai_status.setText)
        self._ai_worker.start()

    def _ai_done(self, cap: str, ht: str):
        self._caption.setPlainText(cap); self._hashtags.setPlainText(ht)
        self._ai_status.setText("✓  Analyse voltooid!")
        self._btn_gen.setEnabled(True); self._pb.setVisible(False)
        self._status.showMessage("✓  Claude AI analyse klaar")

    def _ai_err(self, err: str):
        self._ai_status.setText(f"❌  {err}")
        self._btn_gen.setEnabled(True); self._pb.setVisible(False)
        QMessageBox.warning(self, "AI Fout", err)

    def _run_title(self):
        bts = self._img_bytes()
        key = self._get_key()
        if not bts: return QMessageBox.information(self, "Geen foto", "Laad eerst een foto.")
        if not key: return QMessageBox.warning(self, "API sleutel", "Voer een API sleutel in.")
        self._btn_title.setEnabled(False); self._title_out.setPlainText("⏳ Genereren…")
        self._title_worker = TitleWorker(key, bts, self._title_plat.currentText())
        self._title_worker.title_ready.connect(lambda t: (self._title_out.setPlainText(t), self._btn_title.setEnabled(True)))
        self._title_worker.error_occurred.connect(lambda e: (self._title_out.setPlainText(f"❌ {e}"), self._btn_title.setEnabled(True)))
        self._title_worker.start()

    def _run_ideas(self):
        key = self._get_key()
        if not key: return QMessageBox.warning(self, "API sleutel", "Voer een API sleutel in.")
        self._btn_ideas.setEnabled(False); self._ideas_out.setPlainText("⏳ Genereren…")
        self._ideas_worker = SessionIdeasWorker(key, self._ideas_plat.currentText(), self._ideas_thema.text(), self._ideas_count.value())
        self._ideas_worker.ideas_ready.connect(lambda t: (self._ideas_out.setPlainText(t), self._btn_ideas.setEnabled(True)))
        self._ideas_worker.error_occurred.connect(lambda e: (self._ideas_out.setPlainText(f"❌ {e}"), self._btn_ideas.setEnabled(True)))
        self._ideas_worker.start()

    def _run_reply(self):
        key = self._get_key()
        if not key: return QMessageBox.warning(self, "API sleutel", "Voer een API sleutel in.")
        idx = self._reply_sit.currentIndex()
        sit = self._reply_custom.text() if idx >= len(ReplyTemplateWorker.SITUATIES) else self._reply_sit.currentText()
        self._btn_reply.setEnabled(False); self._reply_out.setPlainText("⏳ Genereren…")
        self._reply_worker = ReplyTemplateWorker(key, sit, self._reply_toon.currentText())
        self._reply_worker.templates_ready.connect(lambda t: (self._reply_out.setPlainText(t), self._btn_reply.setEnabled(True)))
        self._reply_worker.error_occurred.connect(lambda e: (self._reply_out.setPlainText(f"❌ {e}"), self._btn_reply.setEnabled(True)))
        self._reply_worker.start()

    def _clip(self, text: str):
        QApplication.clipboard().setText(text); self._status.showMessage("✓  Gekopieerd naar klembord")

    # ── Batch ─────────────────────────────────────────────────

    def _pick_batch_src(self):
        d = QFileDialog.getExistingDirectory(self, "Bronmap kiezen", str(Path.home()))
        if d: self._batch_src.setText(d)

    def _pick_batch_out(self):
        d = QFileDialog.getExistingDirectory(self, "Uitvoermap kiezen", self._batch_out.text())
        if d: self._batch_out.setText(d)

    def _run_batch(self):
        src = self._batch_src.text()
        if not src or not os.path.isdir(src):
            return QMessageBox.warning(self, "Bronmap", "Kies eerst een bronmap.")
        exts = {".jpg",".jpeg",".png",".gif",".webp",".bmp",".tiff",".tif"}
        files = [str(f) for f in Path(src).iterdir() if f.is_file() and f.suffix.lower() in exts]
        if not files:
            return QMessageBox.information(self, "Geen bestanden", "Geen afbeeldingen gevonden in de bronmap.")

        settings = {
            "exif_remove": self._b_exif.isChecked(),
            "enhance":     self._b_enhance.isChecked(),
            "brightness":  self._enh_sliders["brightness"].value() / 100,
            "contrast":    self._enh_sliders["contrast"].value() / 100,
            "color":       self._enh_sliders["color"].value() / 100,
            "sharpness":   self._enh_sliders["sharpness"].value() / 100,
            "face_check":  self._b_face.isChecked(),
            "watermark":   self._b_wm.isChecked(),
            "wm_settings": self._build_wm_settings() if self._b_wm.isChecked() else None,
            "platform":    self._b_platform.currentText(),
            "format":      self._b_fmt.currentText(),
            "quality":     self._quality.value(),
            "anonymize":   self._b_anon.isChecked(),
            "prefix":      self._prefix.text() or "product_",
        }

        out_dir = self._batch_out.text()
        self._batch_log.clear(); self._batch_log.append(f"Verwerken {len(files)} bestanden → {out_dir}")
        self._batch_pb.setVisible(True); self._batch_pb.setRange(0, len(files)); self._batch_pb.setValue(0)

        self._batch_worker = BatchWorker(files, settings, out_dir)
        self._batch_worker.progress_update.connect(self._batch_progress)
        self._batch_worker.finished.connect(self._batch_done)
        self._batch_worker.error_occurred.connect(lambda e: self._batch_log.append(e))
        self._batch_worker.start()

    def _batch_progress(self, cur: int, total: int, name: str):
        self._batch_pb.setValue(cur)
        self._status.showMessage(f"Batch {cur}/{total}: {name}")

    def _batch_done(self, ok: int, fail: int):
        self._batch_pb.setVisible(False)
        self._batch_log.append(f"✅  Klaar! {ok} geslaagd, {fail} mislukt.")
        self._status.showMessage(f"✓  Batch klaar: {ok} verwerkt, {fail} mislukt")

    # ── Export ────────────────────────────────────────────────

    def _choose_folder(self):
        f = QFileDialog.getExistingDirectory(self, "Uitvoermap kiezen", self._out_folder.text())
        if f: self._out_folder.setText(f); self._settings.setValue("export_folder", f)

    def _open_folder(self):
        folder = self._out_folder.text(); os.makedirs(folder, exist_ok=True)
        import subprocess, platform
        if platform.system()=="Windows": os.startfile(folder)
        elif platform.system()=="Darwin": subprocess.run(["open",folder])
        else: subprocess.run(["xdg-open",folder])

    def _make_name(self, orig: str | None = None) -> str:
        prefix = self._prefix.text() or "product_"
        ext = {"JPEG":"jpg","PNG":"png","WebP":"webp"}.get(self._fmt.currentText(),"jpg")
        if self._chk_anon.isChecked(): return f"{prefix}{uuid.uuid4().hex[:12]}.{ext}"
        stem = Path(orig).stem if orig else datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}{stem}.{ext}"

    def _save_img(self, img: Image.Image, path: str):
        fmt = self._fmt.currentText().upper(); q = self._quality.value()
        if img.mode == "RGBA" and fmt == "JPEG": img = img.convert("RGB")
        elif img.mode not in ("RGB","RGBA","L"): img = img.convert("RGB")
        kw = {"quality":q,"optimize":True} if fmt=="JPEG" else ({"quality":q} if fmt=="WEBP" else {})
        img.save(path, format=fmt, **kw)

    def _export_current(self):
        img = self.canvas.get_current_image()
        if img is None: return self._status.showMessage("⚠ Geen foto geladen")
        folder = self._out_folder.text(); os.makedirs(folder, exist_ok=True)
        name = self._make_name(self._current_path)
        out  = os.path.join(folder, name)
        try:
            self._save_img(img.copy(), out)
            self._exp_log.append(f"✓  {name}")
            self._status.showMessage(f"✓  Opgeslagen: {out}")
            cap = self._caption.toPlainText(); ht = self._hashtags.toPlainText()
            if cap or ht:
                Path(out.rsplit(".",1)[0]+"_ai.txt").write_text(f"BESCHRIJVING:\n{cap}\n\nHASHTAGS:\n{ht}\n", encoding="utf-8")
        except Exception as exc:
            QMessageBox.warning(self, "Exportfout", str(exc))

    def _export_all(self):
        if not self._file_list: return QMessageBox.information(self, "Geen bestanden", "Voeg eerst foto's toe.")
        folder = self._out_folder.text()
        reply = QMessageBox.question(self,"Alles exporteren",f"Alle {len(self._file_list)} foto's exporteren naar:\n{folder}",QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes: return
        os.makedirs(folder, exist_ok=True); self._exp_log.clear()
        for i, path in enumerate(self._file_list):
            try:
                img = normalize_image_mode(Image.open(path))
                out = os.path.join(folder, self._make_name(path))
                self._save_img(img.copy(), out); self._exp_log.append(f"✓  {Path(path).name} → {Path(out).name}")
                self._status.showMessage(f"Exporteren {i+1}/{len(self._file_list)}")
                QApplication.processEvents()
            except Exception as exc:
                self._exp_log.append(f"❌  {Path(path).name}: {exc}")
        self._status.showMessage(f"✓  {len(self._file_list)} foto's geëxporteerd")

    # ── Business: Inkomsten ───────────────────────────────────

    def _add_income(self):
        plat  = self._inc_plat.currentText()
        datum = self._inc_date.date().toString("yyyy-MM-dd")
        amt   = self._inc_amt.value()
        desc  = self._inc_desc.text()
        self._income_tr.add_entry(plat, datum, amt, desc)
        self._inc_desc.clear(); self._refresh_income()
        self._status.showMessage(f"✓  Inkomst toegevoegd: €{amt:.2f} ({plat})")

    def _del_income(self):
        row = self._inc_table.currentRow()
        if row < 0: return
        eid = int(self._inc_table.item(row, 0).data(Qt.ItemDataRole.UserRole))
        self._income_tr.delete_entry(eid); self._refresh_income()

    def _refresh_income(self):
        data = self._income_tr.get_all()
        self._inc_table.setRowCount(len(data))
        for r, e in enumerate(data):
            p = QTableWidgetItem(e["platform"]); p.setData(Qt.ItemDataRole.UserRole, e["id"])
            self._inc_table.setItem(r,0,p)
            self._inc_table.setItem(r,1,QTableWidgetItem(e["datum"]))
            self._inc_table.setItem(r,2,QTableWidgetItem(f"€{e['bedrag']:.2f}"))
            self._inc_table.setItem(r,3,QTableWidgetItem(e.get("beschrijving","")))
        total = sum(e["bedrag"] for e in data)
        self._inc_total.setText(f"Totaal: € {total:.2f}")

    # ── Business: Bestellingen ────────────────────────────────

    def _add_order(self):
        klant = self._ord_klant.text().strip() or "Anoniem"
        plat  = self._ord_plat.currentText()
        desc  = self._ord_desc.text()
        prijs = self._ord_price.value()
        status = self._ord_status.currentText()
        self._order_mgr.add_order(klant, plat, desc, prijs, status)
        self._ord_klant.clear(); self._ord_desc.clear(); self._refresh_orders()
        self._status.showMessage(f"✓  Bestelling toegevoegd: {klant} — €{prijs:.2f}")

    def _update_order_status(self):
        row = self._ord_table.currentRow()
        if row < 0: return
        oid = int(self._ord_table.item(row,0).data(Qt.ItemDataRole.UserRole))
        status, ok = QInputDialog.getItem(self,"Status wijzigen","Nieuwe status:",OrderManager.STATUSSEN,editable=False)
        if ok: self._order_mgr.update_status(oid, status); self._refresh_orders()

    def _del_order(self):
        row = self._ord_table.currentRow()
        if row < 0: return
        oid = int(self._ord_table.item(row,0).data(Qt.ItemDataRole.UserRole))
        self._order_mgr.delete_order(oid); self._refresh_orders()

    def _refresh_orders(self):
        data = self._order_mgr.get_all()
        self._ord_table.setRowCount(len(data))
        STATUS_COLORS = {"Nieuw":"#3498db","In behandeling":"#e67e22","Geleverd":"#2ecc71","Betaald":"#27ae60","Geannuleerd":"#e74c3c"}
        for r, o in enumerate(data):
            k = QTableWidgetItem(o["klant"]); k.setData(Qt.ItemDataRole.UserRole, o["id"])
            self._ord_table.setItem(r,0,k)
            self._ord_table.setItem(r,1,QTableWidgetItem(o["platform"]))
            self._ord_table.setItem(r,2,QTableWidgetItem(o.get("beschrijving","")))
            self._ord_table.setItem(r,3,QTableWidgetItem(f"€{o['prijs']:.2f}"))
            st_item = QTableWidgetItem(o["status"])
            col = STATUS_COLORS.get(o["status"],"#aaa")
            st_item.setForeground(QColor(col))
            self._ord_table.setItem(r,4,st_item)
            self._ord_table.setItem(r,5,QTableWidgetItem(o.get("datum","")))

    # ── Prijscalculator ───────────────────────────────────────

    def _calc_price(self):
        base  = self._pc_base.value()
        count = self._pc_count.value()
        disc  = self._pc_disc.value()
        total, discounted = calculate_bundle_price(base, count, disc)
        self._price_result.setText(
            f"{count}× € {base:.2f}\n"
            f"Zonder korting: € {total:.2f}\n"
            f"Met {disc:.0f}% korting: € {discounted:.2f}\n"
            f"Per foto: € {discounted/count:.2f}"
        )

    # ── Backup ────────────────────────────────────────────────

    def _pick_backup_out(self):
        f, _ = QFileDialog.getSaveFileName(self,"Backup opslaan",self._bkp_out.text(),"Encrypted (*.enc)")
        if f: self._bkp_out.setText(f)

    def _pick_backup_in(self):
        f, _ = QFileDialog.getOpenFileName(self,"Backup kiezen",str(Path.home()),"Encrypted (*.enc)")
        if f: self._bkp_in.setText(f)

    def _pick_restore_dir(self):
        d = QFileDialog.getExistingDirectory(self,"Herstelmap kiezen",str(Path.home()))
        if d: self._bkp_restore_dir.setText(d)

    def _create_backup(self):
        out = self._bkp_out.text()
        if not out: return QMessageBox.warning(self, "Backup", "Kies eerst een bestandslocatie.")
        try:
            self._bkp_status.setText("⏳ Backup maken…"); QApplication.processEvents()
            self._backup_mgr.create_backup(out)
            self._bkp_status.setText(f"✓  Backup opgeslagen:\n{out}")
            self._bkp_status.setStyleSheet("color:#2ecc71;font-size:11px;")
            self._status.showMessage("✓  Versleutelde backup aangemaakt")
        except Exception as exc:
            self._bkp_status.setText(f"❌  {exc}")
            self._bkp_status.setStyleSheet("color:#e74c3c;font-size:11px;")

    def _restore_backup(self):
        src  = self._bkp_in.text()
        dest = self._bkp_restore_dir.text()
        if not src or not os.path.isfile(src):
            return QMessageBox.warning(self,"Herstellen","Kies eerst een backup-bestand.")
        reply = QMessageBox.question(self,"Backup herstellen",f"Bestanden herstellen naar:\n{dest}\n\nDoorgaan?",QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes: return
        try:
            self._backup_mgr.restore_backup(src, dest)
            self._bkp_status.setText(f"✓  Hersteld naar:\n{dest}")
            self._bkp_status.setStyleSheet("color:#2ecc71;font-size:11px;")
        except Exception as exc:
            self._bkp_status.setText(f"❌  {exc}")
            self._bkp_status.setStyleSheet("color:#e74c3c;font-size:11px;")

    # ══════════════════════════════════════════════════════════
    # HULPFUNCTIES
    # ══════════════════════════════════════════════════════════

    @staticmethod
    def _scroll() -> tuple["QScrollArea", QVBoxLayout]:
        sc = QScrollArea(); sc.setWidgetResizable(True)
        body = QWidget(); lay = QVBoxLayout(body); lay.setSpacing(10)
        sc.setWidget(body)
        return sc, lay

    @staticmethod
    def _note(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet("color:#999;font-size:11px;")
        lbl.setWordWrap(True)
        return lbl

    def closeEvent(self, event):
        self._settings.setValue("export_folder", self._out_folder.text())
        super().closeEvent(event)


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

def main():
    os.environ.setdefault("QT_AUTO_SCREEN_SCALE_FACTOR", "1")
    app = QApplication(sys.argv)
    app.setApplicationName("FotoVerwerker")
    app.setOrganizationName("FeetBusiness")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
