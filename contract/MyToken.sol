// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin 라이브러리에서 ERC20과 Ownable 계약을 가져옵니다.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; 

/**
 * @title MyToken
 * @dev Sepolia 테스트를 위한 기본적인 ERC-20 토큰 구현입니다.
 */
contract MyToken is ERC20, Ownable {
    // 토큰은 18자리 소수점(decimals)을 사용합니다.
    // 초기 공급량: 1,000,000 * 10^18
    uint256 private constant INITIAL_SUPPLY = 1_000_000 * 10**18;

    // 생성자: 토큰 이름과 심볼을 설정하고, 배포자에게 초기 공급량을 발행합니다.
    // 배포자는 자동으로 토큰의 소유자(Owner)가 됩니다.
    constructor(address initialOwner)
        ERC20("MyToken", "MTK")
        Ownable(initialOwner)
    {
        // 배포자(initialOwner)에게 초기 토큰을 발행(Mint)합니다.
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    // 추가 기능: 소각(Burn) 기능 (선택 사항)
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}