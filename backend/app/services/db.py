from collections.abc import AsyncIterator
from typing import TypeVar, Generic, Callable, AsyncContextManager
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal

T = TypeVar("T")

SessionFactoryType = Callable[[], AsyncContextManager[AsyncSession]]


class BaseDbService(Generic[T]):
    def __init__(self, session_factory: SessionFactoryType | None = None) -> None:
        self._session_factory = session_factory or SessionLocal

    @property
    def session_factory(self) -> SessionFactoryType:
        return self._session_factory

    @session_factory.setter
    def session_factory(self, value: SessionFactoryType) -> None:
        self._session_factory = value

    @asynccontextmanager
    async def get_session(self) -> AsyncIterator[AsyncSession]:
        async with self._session_factory() as session:
            yield session
