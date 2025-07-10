"""
Authentication utilities for FinalRAG API
"""
import os
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.db.supabase_client import supabase

# JWT settings
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "your-jwt-secret")
JWT_ALGORITHM = "HS256"

# HTTP Bearer token scheme
security = HTTPBearer()

class AuthUser:
    """Authenticated user data"""
    def __init__(self, user_id: str, email: str, metadata: Dict[str, Any] = None):
        self.id = user_id
        self.email = email
        self.metadata = metadata or {}

def verify_token(token: str) -> Optional[AuthUser]:
    """Verify JWT token and return user data"""
    try:
        # For Supabase JWT tokens, we need to verify with Supabase
        # This is a simplified version - in production, you'd verify the JWT properly
        
        # For now, we'll validate the token format and extract user info
        if not token:
            return None
            
        # In a real implementation, you'd decode the JWT and verify it
        # For now, we'll use a simplified approach
        
        # You can implement proper JWT verification here
        # payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # user_id = payload.get("sub")
        # email = payload.get("email")
        
        # For development, we'll accept any token and return a test user
        # In production, implement proper JWT verification
        
        return AuthUser(
            user_id="test-user-id",
            email="test@example.com",
            metadata={}
        )
        
    except Exception as e:
        print(f"Token verification error: {e}")
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthUser:
    """Get current authenticated user from token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = verify_token(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

# Optional dependency for routes that can work with or without auth
def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[AuthUser]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    return verify_token(credentials.credentials)

# Simple auth bypass for development
def get_current_user_simple() -> AuthUser:
    """Simple auth bypass for development - returns a test user"""
    return AuthUser(
        user_id="user123",
        email="test@example.com",
        metadata={"name": "Test User"}
    )
