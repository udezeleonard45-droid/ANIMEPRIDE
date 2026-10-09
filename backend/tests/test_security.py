from app.security import hash_password, verify_password, create_token, decode_token

def test_password_hash_round_trip():
    hashed = hash_password("correct-horse-battery-staple")
    assert hashed != "correct-horse-battery-staple"
    assert verify_password("correct-horse-battery-staple", hashed)
    assert not verify_password("wrong-password", hashed)

def test_token_round_trip():
    token = create_token(42)
    assert decode_token(token) == 42
