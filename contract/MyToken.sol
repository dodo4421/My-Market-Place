// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; 

contract MyToken is ERC20, Ownable {
    uint256 private constant INITIAL_SUPPLY = 1_000_000 * 10**18;

    // Faucet로 지급될 토큰 양 (1000 MTK)
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18;

    // 이미 Faucet을 받은 주소 기록
    mapping(address => bool) public hasReceived;

    constructor(address initialOwner)
        ERC20("MyToken", "MTK")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @notice 토큰 드랍 신청 함수
     * 누구나 1회에 한해 1000 MTK 수령 가능
     */
    function requestTokens() external {
        require(!hasReceived[msg.sender], "Already received tokens");
        require(balanceOf(owner()) >= FAUCET_AMOUNT, "Not enough tokens in faucet");

        hasReceived[msg.sender] = true;
        _transfer(owner(), msg.sender, FAUCET_AMOUNT);
    }

    // 기존 burn 기능 유지
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
