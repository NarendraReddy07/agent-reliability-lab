import os
import hmac
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app.main import app


security = HTTPBasic(auto_error=False)

TOKEN_ALGORITHM = "HS256"
TOKEN_ISSUER = "agent-reliability-lab"
TOKEN_LIFETIME_MINUTES = 30


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


def credentials_are_valid(credentials):
    if credentials is None:
        return False

    try:
        expected_username, expected_password, _ = get_auth_config()
    except HTTPException:
        return False

    username_valid = hmac.compare_digest(
        credentials.username.encode("utf-8"),
        expected_username.encode("utf-8"),
    )

    password_valid = hmac.compare_digest(
        credentials.password.encode("utf-8"),
        expected_password.encode("utf-8"),
    )

    return username_valid and password_valid


def create_access_token(username):
    _, _, secret = get_auth_config()

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=TOKEN_LIFETIME_MINUTES)

    payload = {
        "sub": username,
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": expires,
    }

    return jwt.encode(
        payload,
        secret,
        algorithm=TOKEN_ALGORITHM,
    )


def verify_access_token(token):
    _, _, secret = get_auth_config()

    payload = jwt.decode(
        token,
        secret,
        algorithms=[TOKEN_ALGORITHM],
        issuer=TOKEN_ISSUER,
        options={
            "require": ["sub", "iat", "exp", "iss"],
        },
    )

    username = payload.get("sub")

    if not username:
        raise jwt.InvalidTokenError("Token subject is missing.")

    return username


async def authenticate_admin(
    credentials: HTTPBasicCredentials | None = Depends(security),
):
    get_auth_config()

    if not credentials_are_valid(credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Basic"},
        )

    token = create_access_token(credentials.username)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_LIFETIME_MINUTES * 60,
        "username": credentials.username,
    }


@app.post("/api/auth/login")
async def admin_login(authenticated: dict = Depends(authenticate_admin)):
    return authenticated


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
            if request.url.path != "/api/auth/login":
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
                        headers={"WWW-Authenticate": "Bearer"},
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