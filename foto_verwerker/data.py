"""
data.py — SQLite persistentie voor inkomsten & bestellingen.
Database locatie: ~/feetbusiness_data/feetbusiness.db
"""

import sqlite3
from datetime import datetime

# DATA_DIR wordt beheerd door tools.py — importeer van daar zodat het pad
# slechts op één plek gedefinieerd staat.
from tools import DATA_DIR

DB_PATH = DATA_DIR / "feetbusiness.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Maak alle tabellen aan als ze nog niet bestaan."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS inkomen (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                platform    TEXT    NOT NULL,
                datum       TEXT    NOT NULL,
                bedrag      REAL    NOT NULL,
                beschrijving TEXT   DEFAULT ''
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bestellingen (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                klant       TEXT    NOT NULL,
                platform    TEXT    NOT NULL,
                beschrijving TEXT   DEFAULT '',
                prijs       REAL    NOT NULL,
                status      TEXT    DEFAULT 'Nieuw',
                datum       TEXT    NOT NULL
            )
        """)


# ─────────────────────────────────────────────────────────────

class IncomeTracker:
    """CRUD voor de inkomen-tabel."""

    def add_entry(self, platform: str, datum: str, bedrag: float, beschrijving: str) -> int:
        with get_connection() as conn:
            cur = conn.execute(
                "INSERT INTO inkomen (platform, datum, bedrag, beschrijving) VALUES (?,?,?,?)",
                (platform, datum, bedrag, beschrijving),
            )
            return cur.lastrowid

    def get_all(self) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute("SELECT * FROM inkomen ORDER BY datum DESC").fetchall()
            return [dict(r) for r in rows]

    def get_by_platform(self, platform: str) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM inkomen WHERE platform=? ORDER BY datum DESC", (platform,)
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_entry(self, entry_id: int) -> None:
        with get_connection() as conn:
            conn.execute("DELETE FROM inkomen WHERE id=?", (entry_id,))


# ─────────────────────────────────────────────────────────────

class OrderManager:
    """CRUD voor de bestellingen-tabel."""

    STATUSSEN = ["Nieuw", "In behandeling", "Geleverd", "Betaald", "Geannuleerd"]

    def add_order(self, klant: str, platform: str, beschrijving: str,
                  prijs: float, status: str | None = None) -> int:
        if status is None:
            status = self.STATUSSEN[0]
        with get_connection() as conn:
            cur = conn.execute(
                "INSERT INTO bestellingen (klant, platform, beschrijving, prijs, status, datum) "
                "VALUES (?,?,?,?,?,?)",
                (klant, platform, beschrijving, prijs, status, datetime.now().strftime("%Y-%m-%d")),
            )
            return cur.lastrowid

    def get_all(self) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute("SELECT * FROM bestellingen ORDER BY datum DESC").fetchall()
            return [dict(r) for r in rows]

    def get_by_status(self, status: str) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM bestellingen WHERE status=? ORDER BY datum DESC", (status,)
            ).fetchall()
            return [dict(r) for r in rows]

    def update_status(self, order_id: int, status: str) -> None:
        with get_connection() as conn:
            conn.execute("UPDATE bestellingen SET status=? WHERE id=?", (status, order_id))

    def delete_order(self, order_id: int) -> None:
        with get_connection() as conn:
            conn.execute("DELETE FROM bestellingen WHERE id=?", (order_id,))
