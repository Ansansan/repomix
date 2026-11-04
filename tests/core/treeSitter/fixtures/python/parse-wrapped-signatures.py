def wrapped(
    first_argument: int,
    second_argument: str = "x",
) -> dict[str, int]:
    return {}


async def fetch(
    url: str,
) -> bytes:
    return b""


class Service:
    def handle(
        self,
        request,
    ):
        pass


def with_colon_default(d={"a": 1}, key=lambda x: x) -> None:
    pass


def greet(name): print(f"Hello, {name}")
