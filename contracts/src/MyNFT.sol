// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MyNFT is ERC721, ERC721Burnable, Ownable {
    using Strings for uint256;

    uint256 public mintprice = 0.001 ether; //铸造费
    uint256 public remintprice = 0.0005 ether;
    uint256 public tokenId = 0; //编号
    uint256 public max_supply = 100; //最大供应量

    struct Feature {
        uint8 background;
        uint8 face;
        uint8 eye;
        uint8 mouth;
        uint8 hair;
    } //特征

    mapping(uint256 => Feature) public onlyfeature; //用tokenid对应唯一的特征

    //特征选项 实际最大供应数5*3*2*2*3=180
    string[] private background = ["Green", "Blue", "Purple", "Orange", "Red"]; //0-4 5
    string[] private face = ["Light", "Medium", "Dark"]; //0-2 3
    string[] private eye = ["Normal", "Wink"]; //0-1 2
    string[] private mouth = ["Smile", "Surprise"]; //0-1 2
    string[] private hair = ["Black", "Brown", "Gray"]; //0-2 3
    //背景稀有度,概率依次为40 30 20 8 2
    uint8[] private bgRarity = [40, 70, 90, 98, 100];

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    //核心功能，铸造
    function mint(address recipient) public payable {
        require(msg.sender != owner(), "Owner must use mintByOwner"); //Owner不能调用此函数
        require(tokenId < max_supply, "max supply reached");

        //实际价格，白名单享受半价优惠
        uint256 actualprice = whitelist[msg.sender] ? mintprice / 2 : mintprice;
        require(msg.value >= actualprice, "money not enough");

        //生成特征
        ++tokenId;
        Feature memory nowfeature = getUniqueFeature();
        onlyfeature[tokenId] = nowfeature;
        _safeMint(recipient, tokenId);

        //退还多余的eth
        if (msg.value > actualprice) {
            payable(msg.sender).transfer(msg.value - actualprice);
        }
    }

    //onlyowner铸造不需要付费
    function mintByOwner(address recipient) public onlyOwner {
        require(tokenId < max_supply, "max supply reached");
        //生成特征
        ++tokenId;
        Feature memory nowfeature = getUniqueFeature();
        onlyfeature[tokenId] = nowfeature;
        _safeMint(recipient, tokenId);
    }

    //用户重新生成nft的特征,
    function remint(uint256 _tokenid) public payable {
        require(msg.sender != owner(), "Owner must use remintByOwner");
        require(ownerOf(_tokenid) == msg.sender, "not owner");
        //实际价格
        uint256 actualprice = whitelist[msg.sender]
            ? remintprice / 2
            : remintprice;
        require(msg.value >= actualprice, "money not enough");
        //释放旧特征
        Feature memory oldfeature = onlyfeature[_tokenid];
        bytes32 oldHash = keccak256(
            abi.encodePacked(
                oldfeature.background,
                oldfeature.face,
                oldfeature.eye,
                oldfeature.mouth,
                oldfeature.hair
            )
        );
        usedCombinationHash[oldHash] = false;

        //新特征生成
        Feature memory newfeature = getUniqueFeature();
        onlyfeature[_tokenid] = newfeature;

        //退还多余的eth
        if (msg.value > actualprice) {
            payable(msg.sender).transfer(msg.value - actualprice);
        }
    }

    //Owner能为任何nft免费remint
    function remintByOwner(uint256 _tokenid) public onlyOwner {
        require(_tokenid > 0 && _tokenid <= tokenId, "Token does not exist");
        //释放旧特征
        Feature memory oldfeature = onlyfeature[_tokenid];
        bytes32 oldHash = keccak256(
            abi.encodePacked(
                oldfeature.background,
                oldfeature.face,
                oldfeature.eye,
                oldfeature.mouth,
                oldfeature.hair
            )
        );
        usedCombinationHash[oldHash] = false;

        //新特征的生成
        Feature memory newfeature = getUniqueFeature();
        onlyfeature[_tokenid] = newfeature;
    }

    //获取 除背景 的随机数
    function getRandomNumber(uint8 max) private view returns (uint8) {
        return
            uint8(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            block.timestamp,
                            block.prevrandao,
                            msg.sender,
                            tokenId,
                            gasleft()
                        )
                    )
                ) % max
            );
    }

    //获取 背景 随机数
    function getBgRandomNumber() private view returns (uint8) {
        //首先获取随机数
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        msg.sender,
                        tokenId
                    )
                )
            ) % 100
        );
        //根据随机数确认颜色
        for (uint8 i = 0; i < bgRarity.length; i++) {
            if (random < bgRarity[i]) {
                return i;
            }
        }
        return 0; //默认值
    }

    //储存已使用过的哈希
    mapping(bytes32 => bool) usedCombinationHash;

    //随机生成头像
    function getUniqueFeature() private returns (Feature memory) {
        Feature memory nowfeature;
        bytes32 combinationHash;
        uint8 flag = 0;
        uint32 maxflag = 500;

        do {
            nowfeature = Feature({
                background: uint8(uint256(getBgRandomNumber())),
                face: uint8(uint256(getRandomNumber(uint8(face.length)))),
                eye: uint8(uint256(getRandomNumber(uint8(eye.length)))),
                mouth: uint8(uint256(getRandomNumber(uint8(mouth.length)))),
                hair: uint8(uint256(getRandomNumber(uint8(hair.length))))
            });

            //计算该特征的哈希，最后演算，防止重复
            combinationHash = keccak256(
                abi.encodePacked(
                    nowfeature.background,
                    nowfeature.face,
                    nowfeature.eye,
                    nowfeature.mouth,
                    nowfeature.hair
                )
            );

            flag++;
        } while (usedCombinationHash[combinationHash] && flag < maxflag);

        require(!usedCombinationHash[combinationHash], "all feature used");
        usedCombinationHash[combinationHash] = true;
        return nowfeature;
    }

    // 生成眼睛
    function getEyes(uint8 eyeType) private pure returns (string memory) {
        if (eyeType == 0) {
            // 普通眼睛
            return
                '<circle cx="85" cy="110" r="5" fill="#000"/><circle cx="115" cy="110" r="5" fill="#000"/>';
        } else if (eyeType == 1) {
            // 眨眼
            return
                '<line x1="80" y1="110" x2="90" y2="110" stroke="#000" stroke-width="2"/><circle cx="115" cy="110" r="5" fill="#000"/>';
        }
        return "";
    }

    // 生成嘴巴
    function getMouth(uint8 mouthType) private pure returns (string memory) {
        if (mouthType == 0) {
            // 微笑
            return
                '<path d="M 85 135 Q 100 145 115 135" stroke="#000" stroke-width="2" fill="none"/>';
        } else if (mouthType == 1) {
            // 惊讶
            return
                '<ellipse cx="100" cy="135" rx="8" ry="12" fill="none" stroke="#000" stroke-width="2"/>';
        }
        return "";
    }

    // 显示SVG头像
    function getSVG(uint256 _tokenId) public view returns (string memory) {
        require(_tokenId > 0 && _tokenId <= tokenId, "Token does not exist");
        Feature memory feature = onlyfeature[_tokenId];

        // 颜色映射
        string[5] memory bgColor = [
            "#90EE90", // Green
            "#4169E1", // Blue
            "#9370DB", // Purple
            "#FF7F50", // Orange
            "#FF4500" // Red
        ];
        string[3] memory faceColor = ["#FFDBAC", "#F1C27D", "#E0AC69"];
        string[3] memory hairColor = ["#2C1810", "#DAA520", "#808080"];

        return
            string(
                abi.encodePacked(
                    '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">',
                    // 背景
                    '<rect width="200" height="200" fill="',
                    bgColor[feature.background],
                    '"/>',
                    // 脸
                    '<circle cx="100" cy="120" r="60" fill="',
                    faceColor[feature.face],
                    '" stroke="#000" stroke-width="2"/>',
                    // 头发
                    '<ellipse cx="100" cy="80" rx="65" ry="25" fill="',
                    hairColor[feature.hair],
                    '"/>',
                    // 眼睛
                    getEyes(feature.eye),
                    // 嘴巴
                    getMouth(feature.mouth),
                    "</svg>"
                )
            );
    }

    // 获取特征描述字符串
    function getFeatureString(
        uint256 _tokenId
    ) public view returns (string memory) {
        require(_tokenId > 0 && _tokenId <= tokenId, "Token does not exist");
        Feature memory features = onlyfeature[_tokenId];

        return
            string(
                abi.encodePacked(
                    '{"trait_type": "Background", "value": "',
                    background[features.background],
                    '"},',
                    '{"trait_type": "Face Color", "value": "',
                    face[features.face],
                    '"},',
                    '{"trait_type": "Eye Type", "value": "',
                    eye[features.eye],
                    '"},',
                    '{"trait_type": "Mouth Type", "value": "',
                    mouth[features.mouth],
                    '"},',
                    '{"trait_type": "Hair Color", "value": "',
                    hair[features.hair],
                    '"}'
                )
            );
    }

    //生成动态uri
    function tokenURI(
        uint256 _tokenId
    ) public view override returns (string memory) {
        require(_tokenId > 0 && _tokenId <= tokenId, "Token does not exist");

        // 直接调用统一的getSVG函数
        string memory svg = getSVG(_tokenId);
        string memory featureString = getFeatureString(_tokenId);

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Simple Feature #',
                        _tokenId.toString(),
                        '",',
                        '"description": "A simple unique NFT",',
                        '"image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '",',
                        '"attributes": [',
                        featureString,
                        "]}"
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    //--------白名单功能---------
    mapping(address => bool) public whitelist;

    //添加
    function add_whitelist(address[] calldata _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            whitelist[_address[i]] = true;
        }
    }

    //删除
    function remove_whitelist(address[] calldata _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            whitelist[_address[i]] = false;
        }
    }

    //查询
    function iswhitelisted(address _address) public view returns (bool) {
        return whitelist[_address];
    }

    //Owner提取合约余额
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}
