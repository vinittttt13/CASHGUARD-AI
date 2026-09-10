from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    require_role,
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    oauth2_scheme,
)
from app.core.redis_client import revoke_token
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token,
    RefreshRequest,
    LogoutRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    # Rate limited to 5/min per IP by the rate_limit_middleware in app.main.
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value},
        expires_delta=access_token_expires,
    )
    refresh_token = create_refresh_token(
        data={"sub": user.email, "role": user.role.value}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
    }


@router.post("/refresh", response_model=Token)
async def refresh_token_endpoint(
    body: RefreshRequest, db: AsyncSession = Depends(get_db)
):
    """Rotate the refresh token.

    The old refresh token is single-use: it is revoked here and a brand new
    refresh token is issued alongside the new access token. The token travels
    in the request body, never the URL/query string.
    """
    # verify_refresh_token checks JWT validity, the "refresh" type AND the
    # Redis revocation list.
    payload = await verify_refresh_token(body.refresh_token)
    email: str = payload.get("sub")

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    # Rotation: burn the presented refresh token so it cannot be replayed.
    old_jti = payload.get("jti")
    if old_jti:
        await revoke_token(
            old_jti, ttl_days=settings.refresh_token_expire_days
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    new_access_token = create_access_token(
        data={"sub": email, "role": user.role.value},
        expires_delta=access_token_expires,
    )
    new_refresh_token = create_refresh_token(
        data={"sub": email, "role": user.role.value}
    )
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
    }


@router.post("/logout")
async def logout(
    body: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    """Logout: revoke the current access token's JTI and, if the caller also
    sends its refresh token in the body, revoke that JTI too."""
    from jose import jwt as jose_jwt

    revoked = 0

    # Access token
    try:
        payload = jose_jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        jti = payload.get("jti")
        if jti and await revoke_token(
            jti, ttl_days=settings.refresh_token_expire_days
        ):
            revoked += 1
    except Exception:
        pass  # Token was valid enough for get_current_user; best-effort

    # Refresh token (optional)
    if body is not None and body.refresh_token:
        try:
            r_payload = jose_jwt.decode(
                body.refresh_token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            r_jti = r_payload.get("jti")
            if r_jti and await revoke_token(
                r_jti, ttl_days=settings.refresh_token_expire_days
            ):
                revoked += 1
        except Exception:
            pass

    return {"message": "Successfully logged out", "revoked": revoked}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role,
        jurisdiction=user_in.jurisdiction,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user
