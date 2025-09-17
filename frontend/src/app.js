// 合约配置

const CONTRACT_ADDRESS = "0x62aA5e91C4187Cd419520f9Be5De1a5e7eDEe2C5"; //合约地址
const CONTRACT_ABI = [
    // 基本ERC721功能
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenId() view returns (uint256)",
    "function max_supply() view returns (uint256)",
    "function mintprice() view returns (uint256)",
    "function remintprice() view returns (uint256)",
    "function owner() view returns (address)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",

    // NFT特有功能
    "function mint(address recipient) payable",
    "function mintByOwner(address recipient)",
    "function remint(uint256 tokenId) payable",
    "function remintByOwner(uint256 tokenId)",
    "function getSVG(uint256 tokenId) view returns (string)",
    "function getFeatureString(uint256 tokenId) view returns (string)",
    "function onlyfeature(uint256) view returns (uint8, uint8, uint8, uint8, uint8)",

    // 白名单功能
    "function whitelist(address) view returns (bool)",
    "function iswhitelisted(address) view returns (bool)",
    "function add_whitelist(address[] calldata addresses)",
    "function remove_whitelist(address[] calldata addresses)",

    // 管理功能
    "function withdraw()",
    "function getAvailableCombinations() view returns (uint256)",
    "function usedCombinations() view returns (uint256)",

    // 事件
    "event NFTMinted(address indexed to, uint256 indexed tokenId)",
    "event NFTReminted(uint256 indexed tokenId)",
    "event WhitelistUpdated(address indexed user, bool status)"
];

// 全局变量
let provider;
let signer;
let contract;
let userAddress;
let isOwner = false;

//metaMask检查
function checkMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        const installMessage = `
            <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>请安装MetaMask</h3>
                <p>要使用此DApp，您需要安装MetaMask钱包扩展。</p>
                <a href="https://metamask.io/download.html" target="_blank" 
                   style="background: #f6851b; color: white; padding: 10px 15px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    安装MetaMask
                </a>
            </div>
        `;

        // 在页面显示安装提示
        const container = document.getElementById('mintMessages') || document.body;
        container.innerHTML = installMessage + (container.innerHTML || '');

        // 禁用连接按钮
        const connectBtn = document.getElementById('connectWallet');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = '请安装MetaMask';
        }

        return false;
    }
    return true;
}

// 初始化,页面加载时执行
window.addEventListener('load', async () => {
    await init();
});
//初始化
async function init() {
    // 检查MetaMask
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.BrowserProvider(window.ethereum);

        // 监听账户变化
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
        showMessage('请安装MetaMask钱包', 'error', 'mintMessages');
    }

    // 绑定事件
    bindEvents();

    // 加载合约统计
    await loadContractStats();
}
//绑定事件监听器
function bindEvents() {
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('disconnectWallet').addEventListener('click', disconnectWallet);
    document.getElementById('mintNFT').addEventListener('click', mintNFT);
    document.getElementById('loadNFT').addEventListener('click', loadNFT);
    document.getElementById('remintNFT').addEventListener('click', remintNFT);

    // 管理员功能
    document.getElementById('ownerMint').addEventListener('click', ownerMint);
    document.getElementById('addWhitelist').addEventListener('click', addToWhitelist);
    document.getElementById('removeWhitelist').addEventListener('click', removeFromWhitelist);
    document.getElementById('withdrawFunds').addEventListener('click', withdrawFunds);
    document.getElementById('ownerRemint').addEventListener('click', ownerRemint);

    // 自动填入当前地址
    const mintRecipient = document.getElementById('mintRecipient');
    const ownerMintRecipient = document.getElementById('ownerMintRecipient');

    mintRecipient.addEventListener('focus', () => {
        if (!mintRecipient.value && userAddress) {
            mintRecipient.value = userAddress;
        }
    });

    ownerMintRecipient.addEventListener('focus', () => {
        if (!ownerMintRecipient.value && userAddress) {
            ownerMintRecipient.value = userAddress;
        }
    });
}

// 连接钱包，初始化与合约交互，更新前端UI
async function connectWallet() {
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });// 请求连接钱包
        signer = await provider.getSigner();// 获取签名者，表示当前用户
        userAddress = await signer.getAddress();//当前用户地址
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);//合约实例，与合约交互

        // 更新UI
        document.getElementById('statusDot').classList.add('connected');
        document.getElementById('walletAddress').textContent =
            `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        document.getElementById('connectWallet').textContent = '已连接';
        document.getElementById('connectWallet').disabled = true;

        // 显示断开按钮
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('disconnectWallet').style.display = 'inline-block';
        // 更新余额
        await updateBalance();

        // 检查是否是Owner
        await checkOwner();

        // 更新白名单状态
        await updateWhitelistStatus();

        showMessage('钱包连接成功!', 'success', 'mintMessages');
    } catch (error) {
        // console.error('连接钱包失败:', error);/控制台打印错误
        showMessage('连接钱包失败: ' + error.message, 'error', 'mintMessages');//前端显示错误
    }
}

//断开钱包连接
function disconnectWallet() {
    //清楚全局变量
    provider = null;
    signer = null;
    contract = null;
    userAddress = null;
    isOwner = false;

    // 显示连接按钮，隐藏断开按钮
    document.getElementById('connectWallet').style.display = 'inline-block';
    document.getElementById('disconnectWallet').style.display = 'none';

    //刷新页面
    location.reload();
}
// 处理账户变化
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {// 用户断开连接
        // 刷新页面
        location.reload();
    } else {
        // 用户切换账户
        await connectWallet();
    }
}

// 更新用户余额
async function updateBalance() {
    if (!signer) return;

    try {
        const balance = await provider.getBalance(userAddress);
        const balanceInEth = ethers.formatEther(balance);
        document.getElementById('walletBalance').textContent =
            parseFloat(balanceInEth).toFixed(4) + ' ETH';
    } catch (error) {
        console.error('获取余额失败:', error);
    }
}

//判断user是否为owner
async function checkOwner() {
    if (!contract) return;

    try {
        const owner = await contract.owner();
        isOwner = owner.toLowerCase() === userAddress.toLowerCase();

        if (isOwner) {
            document.getElementById('adminSection').style.display = 'block';
            await updateContractBalance();
        }
    } catch (error) {
        console.error('检查Owner失败:', error);
    }
}

// 更新白名单状态和价格显示
async function updateWhitelistStatus() {
    if (!contract || !userAddress) return;

    try {
        const isWhitelisted = await contract.iswhitelisted(userAddress);
        document.getElementById('whitelistStatus').textContent = isWhitelisted ? '✅' : '❌';

        // 更新价格显示
        const mintPrice = await contract.mintprice();
        const actualPrice = isWhitelisted ? mintPrice / 2n : mintPrice;
        document.getElementById('currentMintPrice').textContent =
            ethers.formatEther(actualPrice) + ' ETH';
    } catch (error) {
        console.error('更新白名单状态失败:', error);
    }
}

// 加载合约统计数据
async function loadContractStats() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE") {
        // 如果合约地址未配置，显示默认值
        document.getElementById('totalSupply').textContent = '0';
        document.getElementById('maxSupply').textContent = '100';
        document.getElementById('mintPrice').textContent = '0.001';
        return;
    }

    try {
        // 如果已连接钱包，使用当前provider，否则使用公共RPC
        let contractInstance;
        if (contract) {
            contractInstance = contract;
        } else {//如果没有连接钱包，也能通过公共RPC读取合约数据
            // 使用公共Sepolia RPC
            const publicProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
            contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, publicProvider);
        }

        const [tokenId, maxSupply, mintPrice] = await Promise.all([
            contractInstance.tokenId(),
            contractInstance.max_supply(),
            contractInstance.mintprice()
        ]);

        document.getElementById('totalSupply').textContent = tokenId.toString();
        document.getElementById('maxSupply').textContent = maxSupply.toString();
        document.getElementById('mintPrice').textContent = ethers.formatEther(mintPrice);

    } catch (error) {
        console.error('加载合约统计失败:', error);
        // 使用默认值
        document.getElementById('totalSupply').textContent = '?';
        document.getElementById('maxSupply').textContent = '100';
        document.getElementById('mintPrice').textContent = '0.001';

        // 如果是合约地址问题，显示提示
        if (error.message.includes('CALL_EXCEPTION')) {
            showMessage('请检查合约地址配置是否正确', 'error', 'mintMessages');
        }
    }
}

async function mintNFT() {
    if (!contract) {
        showMessage('请先连接钱包', 'error', 'mintMessages');
        return;
    }

    const recipient = document.getElementById('mintRecipient').value;
    if (!ethers.isAddress(recipient)) {
        showMessage('请输入有效的接收地址', 'error', 'mintMessages');
        return;
    }

    try {
        const button = document.getElementById('mintNFT');
        button.innerHTML = '<span class="loading"></span> 铸造中...';
        button.disabled = true;

        // 获取价格
        const isWhitelisted = await contract.iswhitelisted(userAddress);
        const mintPrice = await contract.mintprice();
        const actualPrice = isWhitelisted ? mintPrice / 2n : mintPrice;

        const tx = await contract.mint(recipient, { value: actualPrice });
        showMessage('交易已提交，等待确认...', 'success', 'mintMessages');

        const receipt = await tx.wait();
        showMessage(`NFT铸造成功! Token ID: ${await contract.tokenId()}`, 'success', 'mintMessages');

        // 更新统计和余额
        await loadContractStats();
        await updateBalance();

    } catch (error) {
        console.error('铸造失败:', error);
        showMessage('铸造失败: ' + (error.reason || error.message), 'error', 'mintMessages');
    } finally {
        const button = document.getElementById('mintNFT');
        button.innerHTML = '铸造 NFT';
        button.disabled = false;
    }
}

async function loadNFT() {
    if (!contract) {
        showMessage('请先连接钱包', 'error', 'nftMessages');
        return;
    }

    const tokenId = document.getElementById('tokenId').value;
    if (!tokenId || tokenId <= 0) {
        showMessage('请输入有效的Token ID', 'error', 'nftMessages');
        return;
    }

    try {
        const button = document.getElementById('loadNFT');
        button.innerHTML = '<span class="loading"></span> 加载中...';
        button.disabled = true;

        // 获取NFT信息
        const [owner, svg, features] = await Promise.all([
            contract.ownerOf(tokenId),
            contract.getSVG(tokenId),
            contract.onlyfeature(tokenId)
        ]);

        // 显示SVG
        document.getElementById('nftPreview').innerHTML = svg;

        // 显示信息
        document.getElementById('nftName').textContent = `Simple Feature #${tokenId}`;
        document.getElementById('nftOwner').textContent =
            `${owner.slice(0, 6)}...${owner.slice(-4)}`;

        // 显示属性
        const attributeNames = ['Background', 'Face', 'Eye', 'Mouth', 'Hair'];
        const attributeValues = [
            ['Green', 'Blue', 'Purple', 'Orange', 'Red'],
            ['Light', 'Medium', 'Dark'],
            ['Normal', 'Wink'],
            ['Smile', 'Surprise'],
            ['Black', 'Brown', 'Gray']
        ];

        const attributesDiv = document.getElementById('nftAttributes');
        attributesDiv.innerHTML = '';

        features.forEach((feature, index) => {
            const div = document.createElement('div');
            div.className = 'attribute';
            div.innerHTML = `
                        <div class="attribute-name">${attributeNames[index]}</div>
                        <div class="attribute-value">${attributeValues[index][feature]}</div>
                    `;
            attributesDiv.appendChild(div);
        });

        // 检查是否是拥有者
        const isTokenOwner = owner.toLowerCase() === userAddress.toLowerCase();
        document.getElementById('remintNFT').style.display =
            (isTokenOwner || isOwner) ? 'inline-block' : 'none';

        document.getElementById('nftDisplay').style.display = 'block';
        showMessage('NFT加载成功!', 'success', 'nftMessages');

    } catch (error) {
        console.error('加载NFT失败:', error);
        showMessage('加载失败: ' + (error.reason || error.message), 'error', 'nftMessages');
        document.getElementById('nftDisplay').style.display = 'none';
    } finally {
        const button = document.getElementById('loadNFT');
        button.innerHTML = '加载 NFT';
        button.disabled = false;
    }
}

async function remintNFT() {
    if (!contract) return;

    const tokenId = document.getElementById('tokenId').value;
    if (!tokenId) {
        showMessage('请先加载NFT', 'error', 'nftMessages');
        return;
    }

    try {
        const button = document.getElementById('remintNFT');
        button.innerHTML = '<span class="loading"></span> 重新生成中...';
        button.disabled = true;

        let tx;
        if (isOwner) {
            tx = await contract.remintByOwner(tokenId);
        } else {
            const isWhitelisted = await contract.iswhitelisted(userAddress);
            const remintPrice = await contract.remintprice();
            const actualPrice = isWhitelisted ? remintPrice / 2n : remintPrice;
            tx = await contract.remint(tokenId, { value: actualPrice });
        }

        showMessage('交易已提交，等待确认...', 'success', 'nftMessages');
        await tx.wait();

        showMessage('重新生成成功!', 'success', 'nftMessages');

        // 重新加载NFT
        setTimeout(() => loadNFT(), 1000);
        await updateBalance();

    } catch (error) {
        console.error('重新生成失败:', error);
        showMessage('重新生成失败: ' + (error.reason || error.message), 'error', 'nftMessages');
    } finally {
        const button = document.getElementById('remintNFT');
        button.innerHTML = '重新生成 (0.0005 ETH)';
        button.disabled = false;
    }
}

// 管理员功能
async function ownerMint() {
    if (!contract || !isOwner) return;

    const recipient = document.getElementById('ownerMintRecipient').value;
    if (!ethers.isAddress(recipient)) {
        showMessage('请输入有效的接收地址', 'error', 'adminMessages');
        return;
    }

    try {
        const button = document.getElementById('ownerMint');
        button.innerHTML = '<span class="loading"></span> 铸造中...';
        button.disabled = true;

        const tx = await contract.mintByOwner(recipient);
        showMessage('交易已提交，等待确认...', 'success', 'adminMessages');

        const receipt = await tx.wait();
        showMessage(`Owner铸造成功! Token ID: ${await contract.tokenId()}`, 'success', 'adminMessages');

        await loadContractStats();

    } catch (error) {
        console.error('Owner铸造失败:', error);
        showMessage('Owner铸造失败: ' + (error.reason || error.message), 'error', 'adminMessages');
    } finally {
        const button = document.getElementById('ownerMint');
        button.innerHTML = '免费铸造';
        button.disabled = false;
    }
}

async function addToWhitelist() {
    if (!contract || !isOwner) return;

    const address = document.getElementById('whitelistAddress').value;
    if (!ethers.isAddress(address)) {
        showMessage('请输入有效的地址', 'error', 'adminMessages');
        return;
    }

    try {
        const button = document.getElementById('addWhitelist');
        button.innerHTML = '<span class="loading"></span> 添加中...';
        button.disabled = true;

        const tx = await contract.add_whitelist([address]);
        showMessage('交易已提交，等待确认...', 'success', 'adminMessages');

        await tx.wait();
        showMessage('已添加到白名单!', 'success', 'adminMessages');

        document.getElementById('whitelistAddress').value = '';

    } catch (error) {
        console.error('添加白名单失败:', error);
        showMessage('添加白名单失败: ' + (error.reason || error.message), 'error', 'adminMessages');
    } finally {
        const button = document.getElementById('addWhitelist');
        button.innerHTML = '添加';
        button.disabled = false;
    }
}

async function removeFromWhitelist() {
    if (!contract || !isOwner) return;

    const address = document.getElementById('whitelistAddress').value;
    if (!ethers.isAddress(address)) {
        showMessage('请输入有效的地址', 'error', 'adminMessages');
        return;
    }

    try {
        const button = document.getElementById('removeWhitelist');
        button.innerHTML = '<span class="loading"></span> 移除中...';
        button.disabled = true;

        const tx = await contract.remove_whitelist([address]);
        showMessage('交易已提交，等待确认...', 'success', 'adminMessages');

        await tx.wait();
        showMessage('已从白名单移除!', 'success', 'adminMessages');

        document.getElementById('whitelistAddress').value = '';

    } catch (error) {
        console.error('移除白名单失败:', error);
        showMessage('移除白名单失败: ' + (error.reason || error.message), 'error', 'adminMessages');
    } finally {
        const button = document.getElementById('removeWhitelist');
        button.innerHTML = '移除';
        button.disabled = false;
    }
}

async function withdrawFunds() {
    if (!contract || !isOwner) return;

    try {
        const button = document.getElementById('withdrawFunds');
        button.innerHTML = '<span class="loading"></span> 提取中...';
        button.disabled = true;

        const tx = await contract.withdraw();
        showMessage('交易已提交，等待确认...', 'success', 'adminMessages');

        await tx.wait();
        showMessage('资金提取成功!', 'success', 'adminMessages');

        await updateContractBalance();
        await updateBalance();

    } catch (error) {
        console.error('提取资金失败:', error);
        showMessage('提取资金失败: ' + (error.reason || error.message), 'error', 'adminMessages');
    } finally {
        const button = document.getElementById('withdrawFunds');
        button.innerHTML = '提取资金';
        button.disabled = false;
    }
}

async function ownerRemint() {
    if (!contract || !isOwner) return;

    const tokenId = document.getElementById('ownerRemintTokenId').value;
    if (!tokenId || tokenId <= 0) {
        showMessage('请输入有效的Token ID', 'error', 'adminMessages');
        return;
    }

    try {
        const button = document.getElementById('ownerRemint');
        button.innerHTML = '<span class="loading"></span> 重新生成中...';
        button.disabled = true;

        const tx = await contract.remintByOwner(tokenId);
        showMessage('交易已提交，等待确认...', 'success', 'adminMessages');

        await tx.wait();
        showMessage('Owner重新生成成功!', 'success', 'adminMessages');

        document.getElementById('ownerRemintTokenId').value = '';

    } catch (error) {
        console.error('Owner重新生成失败:', error);
        showMessage('Owner重新生成失败: ' + (error.reason || error.message), 'error', 'adminMessages');
    } finally {
        const button = document.getElementById('ownerRemint');
        button.innerHTML = '免费重新生成';
        button.disabled = false;
    }
}

async function updateContractBalance() {
    if (!contract || !isOwner) return;

    try {
        const balance = await provider.getBalance(CONTRACT_ADDRESS);
        const balanceInEth = ethers.formatEther(balance);
        document.getElementById('contractBalance').textContent =
            parseFloat(balanceInEth).toFixed(4) + ' ETH';
    } catch (error) {
        console.error('获取合约余额失败:', error);
    }
}

function showMessage(message, type, containerId = 'mintMessages') {
    const container = document.getElementById(containerId);
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;

    container.appendChild(messageDiv);

    // 5秒后自动消失
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}