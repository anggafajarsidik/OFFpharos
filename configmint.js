export const TO_ADDRESS = '0x1da9f40036bee3fda37ddd9bff624e1125d8991d';
export const CLAIM_ABI = [
  "function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) _allowlistProof, bytes _data)",
  "function balanceOf(address owner) view returns (uint256)",
  "function hasClaimed(address user) view returns (bool)"
];
