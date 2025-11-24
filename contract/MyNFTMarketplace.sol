// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title NFTMarketplace
 * @dev MyToken (ERC-20)과 MyNFT (ERC-721)의 거래를 위한 마켓플레이스 컨트랙트입니다.
 * 거래 시 수수료를 부과합니다.
 */
contract MyNFTMarketplace is Ownable, IERC721Receiver {
    // === 상태 변수 (State Variables) ===

    // ERC20 토큰 (MyToken)의 인터페이스 주소
    IERC20 private immutable tokenContract;
    // ERC721 NFT (MyNFT)의 인터페이스 주소
    IERC721 private immutable nftContract;

    // 리스팅 정보를 저장하는 구조체
    struct Listing {
        uint256 price;     // 토큰(ERC-20)으로 설정된 판매 가격
        address seller;    // 판매자 주소
        bool isListed;     // 리스팅 상태
    }

    // tokenId => Listing 정보 매핑
    mapping(uint256 => Listing) public listings;

    // 거래 수수료 (1000 = 10%)
    uint256 public feePercentage = 100; // 기본 1% (100 / 10000)
    uint256 private constant FEE_DENOMINATOR = 10000; // 분모 (10000 = 100%)
    address public feeRecipient;

    // === 이벤트 (Events) ===

    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTBought(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event FeePercentageUpdated(uint256 newFeePercentage);

    // === 생성자 (Constructor) ===

    /**
     * @notice 컨트랙트를 배포하고 사용할 ERC-20 및 ERC-721 컨트랙트 주소를 설정합니다.
     * @param _tokenAddress 이전에 배포한 MyToken (ERC-20) 컨트랙트 주소
     * @param _nftAddress 이전에 배포한 MyNFT (ERC-721) 컨트랙트 주소
     */
    constructor(address _tokenAddress, address _nftAddress, address _feeRecipient, uint256 initialFeePercentage)
        Ownable(msg.sender)
    {
        require(_tokenAddress != address(0) && _nftAddress != address(0) && _feeRecipient != address(0), "Zero address provided");
        require(initialFeePercentage <= FEE_DENOMINATOR, "Fee percentage too high");

        tokenContract = IERC20(_tokenAddress);
        nftContract = IERC721(_nftAddress);
        feeRecipient = _feeRecipient;
        feePercentage = initialFeePercentage;
    }

    // === Owner 전용 함수 ===

    /**
     * @notice 거래 수수료 비율을 설정합니다. (onlyOwner)
     * @param _newFeePercentage 새로운 수수료 비율 (0 ~ 10000)
     */
    function setFeePercentage(uint256 _newFeePercentage) public onlyOwner {
        require(_newFeePercentage <= FEE_DENOMINATOR, "Fee percentage too high");
        feePercentage = _newFeePercentage;
        emit FeePercentageUpdated(_newFeePercentage);
    }

    // === 핵심 거래 로직 ===

    /**
     * @notice NFT를 판매 목록에 등록합니다.
     * @dev 판매자는 이 함수를 호출하기 전에 MyNFT 컨트랙트에서 Marketplace에게 
     * 해당 토큰 ID에 대한 권한을 위임(_approve)해야 합니다.
     * @param _tokenId 리스팅할 NFT의 ID
     * @param _price 설정할 판매 가격 (MyToken 기준)
     */
    function listNFT(uint256 _tokenId, uint256 _price) public {
        require(_price > 0, "Price must be greater than zero");
        
        // 1. NFT 소유권 확인 (msg.sender가 NFT의 소유자인지 확인)
        require(nftContract.ownerOf(_tokenId) == msg.sender, "Caller is not the owner of the NFT");
        
        // 2. Marketplace가 NFT를 전송할 권한이 있는지 확인
        require(nftContract.isApprovedForAll(msg.sender, address(this)) || nftContract.getApproved(_tokenId) == address(this), 
                "Marketplace not approved to transfer NFT");
        
        // 3. 리스팅 정보 저장/업데이트
        listings[_tokenId] = Listing({
            price: _price,
            seller: msg.sender,
            isListed: true
        });

        emit NFTListed(_tokenId, msg.sender, _price);
    }

    /**
     * @notice 리스팅된 NFT를 구매합니다.
     * @dev 구매자는 이 함수를 호출하기 전에 MyToken 컨트랙트에서 Marketplace에게
     * _price 금액만큼의 토큰 사용 권한을 위임(_approve)해야 합니다.
     * @param _tokenId 구매할 NFT의 ID
     */
    function buyNFT(uint256 _tokenId) public {
        Listing storage listing = listings[_tokenId];
        require(listing.isListed, "NFT is not listed");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");
        
        uint256 salePrice = listing.price;
        address seller = listing.seller;

        // 1. 구매자가 Marketplace에게 충분한 토큰 사용 권한을 부여했는지 확인 (Allowance)
        // require(tokenContract.allowance(msg.sender, address(this)) >= salePrice, "Insufficient token allowance");
        // 실제 transferFrom이 내부적으로 allowance를 확인하므로, 여기서는 토큰 잔액만 확인합니다.
        require(tokenContract.balanceOf(msg.sender) >= salePrice, "Insufficient token balance");

        // 2. 수수료 계산
        uint256 feeAmount = (salePrice * feePercentage) / FEE_DENOMINATOR;
        uint256 netSellerAmount = salePrice - feeAmount;

        // 3. 토큰 전송 (구매자 -> Marketplace -> 판매자/수수료 수령자)

        // a. 구매자 -> 판매자 (수수료 제외)
        // Buyer -> Seller Net Amount
        // OpenZeppelin의 transferFrom은 실패 시 자동으로 revert되므로 반환값 체크 불필요
        tokenContract.transferFrom(msg.sender, seller, netSellerAmount);

        // b. 구매자 -> 수수료 수령자
        // Buyer -> Fee Recipient
        if (feeAmount > 0) {
            tokenContract.transferFrom(msg.sender, feeRecipient, feeAmount);
        }

        // 4. NFT 전송 (Marketplace -> 구매자)
        // 판매자가 리스팅 시 Marketplace에게 NFT를 전송할 권한을 부여했기 때문에, Marketplace가 안전하게 NFT를 전송합니다.
        nftContract.safeTransferFrom(seller, msg.sender, _tokenId);

        // 5. 리스팅 상태 업데이트 (삭제)
        delete listings[_tokenId];

        emit NFTBought(_tokenId, msg.sender, salePrice);
    }

    /**
     * @notice 판매자가 NFT 리스팅을 취소합니다.
     * @param _tokenId 취소할 NFT의 ID
     */
    function cancelListing(uint256 _tokenId) public {
        Listing storage listing = listings[_tokenId];
        
        // 1. 리스팅 존재 여부 및 판매자 확인
        require(listing.isListed, "NFT is not listed");
        require(msg.sender == listing.seller, "Only seller can cancel listing");

        // 2. 리스팅 정보 삭제
        delete listings[_tokenId];

        emit ListingCancelled(_tokenId, msg.sender);
    }

    // === ERC721Receiver 인터페이스 구현 ===
    // 이 함수는 Marketplace가 NFT를 직접 소유할 필요가 없으므로 간단히 revert 처리하여 
    // Marketplace 주소로 실수로 NFT가 전송되는 것을 방지합니다. 
    // 리스팅은 "approve 후 Marketplace는 NFT를 보관하지 않고 판매자에게서 직접 전송"하는 방식을 사용합니다.
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external pure override returns (bytes4) {
        // Marketplace는 NFT를 받지 않습니다. (거래 흐름: 판매자 -> 구매자)
        revert("Marketplace does not accept direct NFT transfers");
    }

    // === 기타 함수 ===
    
    /**
     * @notice 주어진 토큰 ID에 대한 현재 리스팅 정보를 반환합니다.
     */
    function getListing(uint256 _tokenId) public view returns (uint256 price, address seller, bool isListed) {
        Listing storage listing = listings[_tokenId];
        return (listing.price, listing.seller, listing.isListed);
    }
}