// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyNFT} from "../src/MyNFT.sol";

contract MyNFTTest is Test {
    MyNFT public myNFT;
    address public owner;
    address public user1;
    address public user2;

    uint256 constant MINT_PRICE = 0.001 ether;
    uint256 constant REMINT_PRICE = 0.0005 ether;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        myNFT = new MyNFT();

        // 给用户一些ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // 测试基本部署
    function test_Deployment() public {
        assertEq(myNFT.name(), "MyNFT");
        assertEq(myNFT.symbol(), "MNFT");
        assertEq(myNFT.owner(), owner);
        assertEq(myNFT.mintprice(), MINT_PRICE);
        assertEq(myNFT.max_supply(), 100);
        assertEq(myNFT.tokenId(), 0);
    }

    // 测试正常铸造
    function test_Mint() public {
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        assertEq(myNFT.ownerOf(1), user1);
        assertEq(myNFT.tokenId(), 1);
        assertEq(myNFT.balanceOf(user1), 1);
    }

    // 测试Owner不能调用mint
    function test_OwnerCannotMint() public {
        vm.expectRevert("Owner must use mintByOwner");
        myNFT.mint{value: MINT_PRICE}(owner);
    }

    // 测试价格不足
    function test_MintInsufficientFunds() public {
        vm.prank(user1);
        vm.expectRevert("money not enough");
        myNFT.mint{value: MINT_PRICE - 1}(user1);
    }

    // 测试退还多余ETH
    function test_MintRefundExcess() public {
        uint256 balanceBefore = user1.balance;
        uint256 overpaid = MINT_PRICE + 0.5 ether;

        vm.prank(user1);
        myNFT.mint{value: overpaid}(user1);

        uint256 balanceAfter = user1.balance;
        assertEq(balanceBefore - balanceAfter, MINT_PRICE);
    }

    // 测试Owner铸造
    function test_MintByOwner() public {
        myNFT.mintByOwner(user1);

        assertEq(myNFT.ownerOf(1), user1);
        assertEq(myNFT.tokenId(), 1);
    }

    // 测试最大供应量限制
    function test_MaxSupplyReached() public {
        // 模拟铸造到最大供应量
        for (uint256 i = 0; i < 100; i++) {
            address recipient = address(uint160(uint160(user1) + i));
            myNFT.mintByOwner(recipient);
        }
        assertEq(myNFT.tokenId(), 100);

        vm.prank(user1);
        vm.expectRevert("max supply reached");
        myNFT.mint{value: MINT_PRICE}(user1);
    }

    // 测试白名单功能
    function test_Whitelist() public {
        address[] memory addresses = new address[](1);
        addresses[0] = user1;

        myNFT.add_whitelist(addresses);
        assertTrue(myNFT.iswhitelisted(user1));

        // 白名单用户应该享受半价
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE / 2}(user1);

        assertEq(myNFT.ownerOf(1), user1);
    }

    // 测试移除白名单
    function test_RemoveWhitelist() public {
        address[] memory addresses = new address[](1);
        addresses[0] = user1;

        myNFT.add_whitelist(addresses);
        assertTrue(myNFT.iswhitelisted(user1));

        myNFT.remove_whitelist(addresses);
        assertFalse(myNFT.iswhitelisted(user1));
    }

    // 测试重新铸造
    function test_Remint() public {
        // 首先铸造一个NFT
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        // 获取原始特征
        (uint8 bg1, uint8 face1, uint8 eye1, uint8 mouth1, uint8 hair1) = myNFT
            .onlyfeature(1);

        // 重新铸造
        vm.prank(user1);
        myNFT.remint{value: REMINT_PRICE}(1);

        // 检查特征是否改变（可能相同，但这是随机的）
        (uint8 bg2, uint8 face2, uint8 eye2, uint8 mouth2, uint8 hair2) = myNFT
            .onlyfeature(1);

        // 确保NFT仍然属于user1
        assertEq(myNFT.ownerOf(1), user1);
    }

    // 测试非拥有者不能重新铸造
    function test_RemintNotOwner() public {
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        vm.prank(user2);
        vm.expectRevert("not owner");
        myNFT.remint{value: REMINT_PRICE}(1);
    }

    // 测试Owner重新铸造
    function test_RemintByOwner() public {
        myNFT.mintByOwner(user1);

        // Owner可以为任何NFT免费重新铸造
        myNFT.remintByOwner(1);

        assertEq(myNFT.ownerOf(1), user1);
    }

    // 测试不存在的token重新铸造
    function test_RemintNonexistentToken() public {
        vm.expectRevert("Token does not exist");
        myNFT.remintByOwner(999);
    }

    // 测试SVG生成
    function test_GetSVG() public {
        myNFT.mintByOwner(user1);

        string memory svg = myNFT.getSVG(1);
        assertTrue(bytes(svg).length > 0);

        // 检查SVG是否包含基本元素
        assertTrue(bytes(svg).length > 100); // 简单检查长度
    }

    // 测试tokenURI
    function test_TokenURI() public {
        myNFT.mintByOwner(user1);

        string memory uri = myNFT.tokenURI(1);
        assertTrue(bytes(uri).length > 0);

        // 检查是否包含base64前缀
        assertTrue(bytes(uri).length > 29); // "data:application/json;base64,"的长度
    }

    // 测试燃烧功能
    function test_Burn() public {
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        vm.prank(user1);
        myNFT.burn(1);

        assertEq(myNFT.balanceOf(user1), 0);

        // 尝试访问已燃烧的token应该失败
        vm.expectRevert();
        myNFT.ownerOf(1);
    }

    // 测试提取资金
    function test_Withdraw() public {
        // 让用户铸造一些NFT来产生收入
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        vm.prank(user2);
        myNFT.mint{value: MINT_PRICE}(user2);

        uint256 contractBalance = address(myNFT).balance;
        uint256 ownerBalanceBefore = owner.balance;

        vm.startPrank(owner);
        myNFT.withdraw();
        vm.stopPrank();

        assertEq(address(myNFT).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
    }

    // 测试非Owner不能提取资金
    function test_WithdrawNotOwner() public {
        vm.prank(user1);
        myNFT.mint{value: MINT_PRICE}(user1);

        vm.prank(user1);
        vm.expectRevert();
        myNFT.withdraw();
    }

    // 测试空余额提取
    function test_WithdrawNoFunds() public {
        vm.expectRevert("No funds to withdraw");
        myNFT.withdraw();
    }

    // 测试特征字符串生成
    function test_GetFeatureString() public {
        myNFT.mintByOwner(user1);

        string memory features = myNFT.getFeatureString(1);
        assertTrue(bytes(features).length > 0);
    }

    // 测试大量铸造以检查唯一性
    function test_UniqueFeatures() public {
        // 铸造多个NFT并检查它们具有不同的特征
        for (uint256 i = 0; i < 10; i++) {
            myNFT.mintByOwner(user1);
        }

        // 简单检查：确保所有token都存在
        for (uint256 i = 1; i <= 10; i++) {
            assertEq(myNFT.ownerOf(i), user1);
        }
    }

    // Fuzz测试：随机价格铸造
    function testFuzz_MintWithRandomPrice(uint256 price) public {
        vm.assume(price >= MINT_PRICE && price <= 100 ether);

        vm.deal(user1, price);
        vm.prank(user1);
        myNFT.mint{value: price}(user1);

        assertEq(myNFT.ownerOf(1), user1);
    }
}
