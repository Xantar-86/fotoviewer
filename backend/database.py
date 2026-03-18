import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Support both PostgreSQL (Railway) and SQLite (local dev)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./feetbusiness.db")

# Fix Railway's postgres:// prefix (SQLAlchemy requires postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(100), nullable=False)
    datum = Column(String(20), nullable=False)
    bedrag = Column(Float, nullable=False)
    beschrijving = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    klant = Column(String(200), nullable=False)
    platform = Column(String(100), nullable=False)
    beschrijving = Column(Text, default="")
    prijs = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), default="Nieuw")
    datum = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI route handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
