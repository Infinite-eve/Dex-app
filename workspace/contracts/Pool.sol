// SPDX-License-Identifier: MIT
//Pool合约用于创建流动性池
//流动性池是用于存储和交换两种ERC20代币的合约
//该合约继承自LPToken合约
//LPToken是用于表示流动性池中代币份额的代币

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // 导入 Ownable 合约
import "./LPToken.sol";

contract Pool is LPToken, ReentrancyGuard, Ownable {
    IERC20 immutable i_token0;//对 ERC-20 代币合约的不可变引用
    IERC20 immutable i_token1;

    address immutable i_token0_address;//对 ERC-20 地址的不可变引用
    address immutable i_token1_address;

    uint256 constant INITIAL_RATIO = 2; //token0:token1 = 1:2
    //初始比例为1:2，即1个token0需要2个token1
    //可以修改初始比例

    mapping(address => uint256) tokenBalances;
    //tokenBalances是一个映射，用于存储每个代币的余额
    //key是代币地址，value是代币余额

    // 费用相关变量
    uint256 public constant FEE_DENOMINATOR = 10000; // 费用分母，用于计算精确的费率
    uint256 public tradingFee = 30; // 交易费率 0.3% (30/10000)
    address public feeCollector; // 费用接收地址

    // 新增激励池变量
    uint256 public liquidityProviderIncentives; // LP激励池
    uint256 public swapperRebates; // 交易返利池
    
    // 新增费用分配比例
    uint256 public lpIncentiveShare = 5000;   // LP激励比例 50% (5000/10000)
    uint256 public swapperRebateShare = 2000; // 交易返利比例 20% (2000/10000)
    uint256 public protocolFeeShare = 3000;   // 协议费用比例 30% (3000/10000)
    
    // 新增事件
    event IncentiveDistributed(address indexed recipient, uint256 amount, string incentiveType);
    event FeeSharesUpdated(uint256 lpShare, uint256 swapperShare, uint256 protocolShare);

    //事件用于记录流动性池中的代币添加和交换操作
    event AddedLiquidity(
        uint256 indexed lpToken,
        address token0,
        uint256 indexed amount0,
        address token1,
        uint256 indexed amount1
    );

    event WithdrawLiquidity(
        uint256 indexed lpToken,
        address token0,
        uint256 indexed amount0,
        address token1,
        uint256 indexed amount1
    );

    event Swapped(
        address tokenIn,
        uint256 indexed amountIn,
        address tokenOut,
        uint256 indexed amountOut
    );

    event FeeCollected(address indexed token, uint256 indexed amount);

    //构造函数，用于初始化流动性池
    //token0和token1是流动性池中的两种代币
    //LPToken是用于表示流动性池中代币份额的代币
    constructor(address token0, address token1, address _feeCollector) LPToken("LPToken", "LPT") Ownable(msg.sender) {
        i_token0 = IERC20(token0);
        i_token1 = IERC20(token1);

        i_token0_address = token0;
        i_token1_address = token1;
        
        feeCollector = _feeCollector; // 初始化费用收集地址
    }

    //计算代币兑换的输出数量
    //tokenIn是输入代币地址
    //amountIn是输入代币数量
    //tokenOut是输出代币地址
    function getAmountOut(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        uint256 balanceOut = tokenBalances[tokenOut];
        uint256 balanceIn = tokenBalances[tokenIn];
        
        require(balanceIn > 0 && balanceOut > 0, "Insufficient liquidity");
        
        // 计算交易费用
        uint256 fee = (amountIn * tradingFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;
        
        // 使用扣除费用后的金额计算输出
        uint256 amountOut = (balanceOut * amountInAfterFee) / (balanceIn + amountInAfterFee);

        return amountOut;
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public nonReentrant {
        // input validity checks
        //检查输入、输出的代币和定义的代币是否相同
        require(tokenIn != tokenOut, "Same tokens");
        require(
            tokenIn == i_token0_address || tokenIn == i_token1_address,
            "Invalid token"
        );
        require(
            tokenOut == i_token0_address || tokenOut == i_token1_address,
            "Invalid token"
        );
        require(amountIn > 0, "Zero amount");

        // 获取当前池中的余额
        uint256 balanceIn = tokenBalances[tokenIn];  // 添加这行来定义balanceIn变量
        uint256 balanceOut = tokenBalances[tokenOut];
        
        // 计算交易费用
        uint256 fee = (amountIn * tradingFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;

        // 分配费用到各个部分
        uint256 lpFee = (fee * lpIncentiveShare) / FEE_DENOMINATOR;
        uint256 swapperFee = (fee * swapperRebateShare) / FEE_DENOMINATOR;
        uint256 protocolFee = fee - lpFee - swapperFee;
        
        // 先将所有代币转给合约
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Transfer tokenIn failed"
        );
        
        // 更新LP激励池和代币余额
        if (lpFee > 0) {
            liquidityProviderIncentives += lpFee;
            // 注意：这些代币已经在池子里，所以计入tokenBalances
            tokenBalances[tokenIn] += lpFee;
        }
        
        // 为交易用户提供返利激励
        if (swapperFee > 0) {
            // 立即返还交易者费用
            require(
                IERC20(tokenIn).transfer(msg.sender, swapperFee),
                "Swapper rebate failed"
            );
            emit IncentiveDistributed(msg.sender, swapperFee, "SWAPPER_REBATE");
            // 此部分代币已返还，不计入tokenBalances
        }
        
        // 协议费用转移到feeCollector
        if (protocolFee > 0) {
            require(
                IERC20(tokenIn).transfer(feeCollector, protocolFee),
                "Protocol fee transfer failed"
            );
            emit FeeCollected(tokenIn, protocolFee);
            // 此部分代币已转出，不计入tokenBalances
        }

        // 计算输出代币数量 (使用扣除费用后的输入金额)
        // 计算输出代币数量 (使用原始输入金额)
        uint256 amountOut = getAmountOut(tokenIn, amountIn, tokenOut);
        require(amountOut > 0, "Insufficient output amount");

        // 用于交易的代币已经转移到合约，不需要再次调用transferFrom
        require(
            IERC20(tokenOut).transfer(msg.sender, amountOut),
            "Swap Failed"
        );

        // update pool balances
        tokenBalances[tokenIn] = balanceIn + amountInAfterFee;  // 实际交易部分
        tokenBalances[tokenOut] -= amountOut;
        //emit事件，用于记录代币交换操作
        emit Swapped(tokenIn, amountInAfterFee, tokenOut, amountOut);
    }

    // 新增函数：分发LP激励
    function distributeLpIncentives(address[] calldata providers, uint256[] calldata amounts) external onlyOwner {
        require(providers.length == amounts.length, "Arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalAmount <= liquidityProviderIncentives, "Insufficient LP incentive balance");
        liquidityProviderIncentives -= totalAmount;
        
        for (uint256 i = 0; i < providers.length; i++) {
            if (amounts[i] > 0) {
                // 这里可以根据实际情况选择token0或token1或两者的组合进行分发
                require(
                    i_token0.transfer(providers[i], amounts[i]),
                    "LP incentive transfer failed"
                );
                emit IncentiveDistributed(providers[i], amounts[i], "LP_REWARD");
                
                // 注意：这里不需要更新tokenBalances，因为激励已经在费用收集时加入过了
                // 这里是从pool合约向LP提供者转出代币
            }
        }
    }
    
    // 设置费用分配比例
    function setFeeShares(
        uint256 _lpShare,
        uint256 _swapperShare,
        uint256 _protocolShare
    ) external onlyOwner {
        require(_lpShare + _swapperShare + _protocolShare == FEE_DENOMINATOR, "Shares must sum to 100%");
        
        lpIncentiveShare = _lpShare;
        swapperRebateShare = _swapperShare;
        protocolFeeShare = _protocolShare;
        
        emit FeeSharesUpdated(_lpShare, _swapperShare, _protocolShare);
    }
    
    // 修改LP激励分配功能，考虑不同代币的激励和余额同步
    function claimLpIncentives(bool useToken0) external {
        uint256 userLpShare = balanceOf(msg.sender);
        require(userLpShare > 0, "No LP tokens owned");
        
        uint256 totalLp = totalSupply();
        uint256 incentiveAmount = (liquidityProviderIncentives * userLpShare * 1e18) / totalLp / 1e18;
        
        require(incentiveAmount > 0, "No incentives to claim");
        liquidityProviderIncentives -= incentiveAmount;
        
        // 从池中转出激励，根据用户选择使用token0或token1
        if (useToken0) {
            require(
                i_token0.transfer(msg.sender, incentiveAmount),
                "Incentive transfer failed"
            );
            // 更新tokenBalances，保持一致性
            tokenBalances[i_token0_address] -= incentiveAmount;
            emit IncentiveDistributed(msg.sender, incentiveAmount, "LP_REWARD_CLAIM_TOKEN0");
        } else {
            // 如果选择token1，需要根据当前汇率计算等值的token1
            uint256 token1Amount = (incentiveAmount * tokenBalances[i_token1_address]) / tokenBalances[i_token0_address];
            require(
                i_token1.transfer(msg.sender, token1Amount),
                "Incentive transfer failed"
            );
            // 更新tokenBalances，保持一致性
            tokenBalances[i_token1_address] -= token1Amount;
            emit IncentiveDistributed(msg.sender, token1Amount, "LP_REWARD_CLAIM_TOKEN1");
        }
    }

    //计算添加流动性所需的token1数量
    //amount0是添加的token0数量
    function getRequiredAmount1(uint256 amount0) public view returns (uint256) {
        uint256 balance0 = tokenBalances[i_token0_address];
        uint256 balance1 = tokenBalances[i_token1_address];

        if (balance0 == 0 || balance1 == 0) {
            return amount0 * INITIAL_RATIO;
        }
        //返回可以兑换的token1数量
        return (amount0 * balance1) / balance0;
    }

    function addLiquidity(uint256 amount0) public nonReentrant {
        // input validity check
        //amount0是添加的token0数量
        require(amount0 > 0, "Amount must be greater than 0");

        // calculate and mint liquidity tokens
        uint256 amount1 = getRequiredAmount1(amount0);
        uint256 amountLP;
        //totalsupply()是LPToken的总供应量，ERC20标准接口
        if (totalSupply() > 0) {
            amountLP =
                (amount0 * totalSupply()) /
                tokenBalances[i_token0_address] ;
        } else {
            //首次添加流动性，amountLP等于amount0
            amountLP = amount0;
        }
        _mint(msg.sender, amountLP);//铸造LP代币

        // deposit token0
        require(
            i_token0.transferFrom(msg.sender, address(this), amount0),
            "Transfer Alpha failed"
        );
        tokenBalances[i_token0_address] += amount0;

        // deposit token1
        require(
            i_token1.transferFrom(msg.sender, address(this), amount1),
            "Transfer Beta failed"
        );
        tokenBalances[i_token1_address] += amount1;

        emit AddedLiquidity(
            amountLP,
            i_token0_address,
            amount0,
            i_token1_address,
            amount1
        );
    }

    // function to withdraw liquidity
    //销毁LP代币，并转移代币
    function withdrawLiquidity(uint256 lpAmount) public nonReentrant {
        syncBalances();
        // 检查用户是否有足够的LP代币
        require(lpAmount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= lpAmount, "Insufficient LP tokens");
        
        // 计算应该提取的token0和token1数量
        uint256 totalLP = totalSupply();
        uint256 amount0 = (lpAmount * tokenBalances[i_token0_address]) / totalLP;
        uint256 amount1 = (lpAmount * tokenBalances[i_token1_address]) / totalLP;
        
        // 检查池中是否有足够的流动性
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity");
        
        // 销毁LP代币
        _burn(msg.sender, lpAmount);
        
        // 转账代币
        require(i_token0.transfer(msg.sender, amount0), "Transfer token0 failed");
        require(i_token1.transfer(msg.sender, amount1), "Transfer token1 failed");
        
        // 更新池中余额
        tokenBalances[i_token0_address] -= amount0;
        tokenBalances[i_token1_address] -= amount1;
        
        emit WithdrawLiquidity(
            lpAmount,
            i_token0_address,
            amount0,
            i_token1_address,
            amount1
        );
    }

    // 仅所有者可以更新费率
    function setTradingFee(uint256 _tradingFee) external onlyOwner {
        require(_tradingFee <= 100, "Fee too high"); // 限制最高费率为 1%
        tradingFee = _tradingFee;
    }

    // 仅所有者可以更新费用收集地址
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Zero address");
        feeCollector = _feeCollector;
    }

    // 添加一个同步函数，用于同步更新 tokenBalances
    function syncBalances() public {
        tokenBalances[i_token0_address] = i_token0.balanceOf(address(this));
        tokenBalances[i_token1_address] = i_token1.balanceOf(address(this));
    }

    //测试不过，提示补充此函数
    //getReserves函数返回池中代币的余额和LPToken的总供应量
    function getReserves()
        public
        view
        returns (uint256, uint256, uint256)
    {
        return (
            i_token0.balanceOf(address(this)),
            i_token1.balanceOf(address(this)),
            totalSupply()
        );
    }
}