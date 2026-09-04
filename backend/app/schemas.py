from pydantic import BaseModel

class CropInput(BaseModel):
    phone: str
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float

class UserRegister(BaseModel):
    uid: str
    phone: str
    name: str

class OTPDocument(BaseModel):
    phone: str
    otp: str
    expires_at: str

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str


class MarketPriceRequest(BaseModel): 
    crop: str
    location: str = "Coimbatore, Tamil Nadu, India"
    variety: str
