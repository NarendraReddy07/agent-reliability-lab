import os
import hmac
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, status
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

load_dotenv()

from backend.app.main import app


TOKEN_ALGORITHM = "HS256"
TOKEN_ISSUER = "agent-reliability-lab"
ACCESS_TOKEN_MINUTES = 30
REFRESH_TOKEN_DAYS = 7

LOGIN_PATH = "/api/auth/login"
REFRESH_PATH = "/api/auth/refresh"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


def get_auth_config():
    username = os.getenv("ADMIN_USERNAME")
    password = os.getenv("ADMIN_PASSWORD")
    secret = os.getenv("JWT_SECRET_KEY")

    if not username or not password or not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication configuration is incomplete.",
        )

    if len(secret) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET_KEY must contain at least 32 characters.",
        )

    return username, password, secret


def credentials_are_valid(username, password):
    expected_username, expected_password, _ = get_auth_config()

    username_valid = hmac.compare_digest(
        username.encode("utf-8"),
        expected_username.encode("utf-8"),
    )
    password_valid = hmac.compare_digest(
        password.encode("utf-8"),
        expected_password.encode("utf-8"),
    )

    return username_valid and password_valid


def create_token(username, token_use, lifetime):
    _, _, secret = get_auth_config()

    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": now + lifetime,
        "token_use": token_use,
    }

    return jwt.encode(payload, secret, algorithm=TOKEN_ALGORITHM)


def create_access_token(username):
    return create_token(
        username,
        "access",
        timedelta(minutes=ACCESS_TOKEN_MINUTES),
    )


def create_refresh_token(username):
    return create_token(
        username,
        "refresh",
        timedelta(days=REFRESH_TOKEN_DAYS),
    )


def verify_token(token, expected_use):
    _, _, secret = get_auth_config()

    payload = jwt.decode(
        token,
        secret,
        algorithms=[TOKEN_ALGORITHM],
        issuer=TOKEN_ISSUER,
        options={"require": ["sub", "iat", "exp", "iss", "token_use"]},
    )

    username = payload.get("sub")

    if not username or payload.get("token_use") != expected_use:
        raise jwt.InvalidTokenError("Invalid token type or subject.")

    return username


def verify_access_token(token):
    return verify_token(token, "access")


def verify_refresh_token(token):
    return verify_token(token, "refresh")


@app.post("/api/auth/login")
async def admin_login(credentials: LoginRequest):
    get_auth_config()

    if not credentials_are_valid(
        credentials.username,
        credentials.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    return {
        "access_token": create_access_token(credentials.username),
        "refresh_token": create_refresh_token(credentials.username),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
        "refresh_expires_in": REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        "username": credentials.username,
    }


@app.post("/api/auth/refresh")
async def refresh_access_token(request: RefreshRequest):
    try:
        username = verify_refresh_token(request.refresh_token)
    except HTTPException:
        raise
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session expired or invalid. Please sign in again.",
        )

    return {
        "access_token": create_access_token(username),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
    }


@app.get("/api/auth/me")
async def current_admin(request: Request):
    authorization = request.headers.get("Authorization", "")
    parts = authorization.split(" ", 1)

    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        username = verify_access_token(parts[1])
    except HTTPException:
        raise
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
        )

    return {
        "authenticated": True,
        "username": username,
        "role": "Administrator",
    }


class AdminWriteProtectionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if request.url.path not in {LOGIN_PATH, REFRESH_PATH}:
                try:
                    authorization = request.headers.get(
                        "Authorization", ""
                    )
                    parts = authorization.split(" ", 1)

                    if len(parts) != 2 or parts[0].lower() != "bearer":
                        raise jwt.InvalidTokenError(
                            "Bearer token required."
                        )

                    verify_access_token(parts[1])

                except HTTPException as exc:
                    return JSONResponse(
                        status_code=exc.status_code,
                        content={"detail": exc.detail},
                    )

                except jwt.InvalidTokenError:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Session expired or invalid. Please sign in again."
                        },
                    )

                except Exception:
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content={
                            "detail": "Authentication service is unavailable."
                        },
                    )

        return await call_next(request)


app.add_middleware(AdminWriteProtectionMiddleware)