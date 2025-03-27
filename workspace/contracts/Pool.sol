// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LPToken.sol";

contract Pool is LPToken, ReentrancyGuard {
    IERC20 immutable i_token0;
    IERC20 immutable i_token1;

    address immutable i_token0_address;
    address immutable i_token1_address;

    uint256 constant INITIAL_RATIO = 2; //token0:token1 = 1:2

    mapping(address => uint256) tokenBalances;

    event AddedLiquidity(
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

    constructor(address token0, address token1) LPToken("LPToken", "LPT") {
        i_token0 = IERC20(token0);
        i_token1 = IERC20(token1);

        i_token0_address = token0;
        i_token1_address = token1;
    }

    function getAmountOut(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        uint256 balanceOut = tokenBalances[tokenOut];
        uint256 balanceIn = tokenBalances[tokenIn];
        uint256 amountOut = (balanceOut * amountIn) / (balanceIn + amountIn);

        return amountOut;
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public nonReentrant {
        // input validity checks
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

        uint256 amountOut = getAmountOut(tokenIn, amountIn, tokenOut);

        // swapping tokens
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Swap Failed"
        );
        require(
            IERC20(tokenOut).transfer(msg.sender, amountOut),
            "Swap Failed"
        );

        // update pool balances
        tokenBalances[tokenIn] += amountIn;
        tokenBalances[tokenOut] -= amountOut;

        emit Swapped(tokenIn, amountIn, tokenOut, amountOut);
    }

    function getRequiredAmount1(uint256 amount0) public view returns (uint256) {
        uint256 balance0 = tokenBalances[i_token0_address];
        uint256 balance1 = tokenBalances[i_token1_address];

        if (balance0 == 0 || balance1 == 0) {
            return amount0 * INITIAL_RATIO;
        }
        return (amount0 * balance1) / balance0;
    }

    function addLiquidity(uint256 amount0) public nonReentrant {
        // input validity check
        require(amount0 > 0, "Amount must be greater than 0");

        // calculate and mint liquidity tokens
        uint256 amount1 = getRequiredAmount1(amount0);
        uint256 amountLP;
        if (totalSupply() > 0) {
            amountLP =
                (amount0 * totalSupply()) /
                tokenBalances[i_token0_address];
        } else {
            amountLP = amount0;
        }
        _mint(msg.sender, amountLP);

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

    // function to withdraw liquidity 自己补充
    function withdrawingliquidity(uint256 amount0, uint256 amount1) public {
        // input validity check
        require(amount0 > 0 && amount1 > 0, "Amount must be greater than 0");

        // calculate and burn liquidity tokens
        uint256 amountLP = (amount0 * totalSupply()) /
            tokenBalances[i_token0_address];
        _burn(msg.sender, amountLP);

        // withdraw token0
        require(
            i_token0.transfer(msg.sender, amount0),
            "Transfer Alpha failed"
        );
        tokenBalances[i_token0_address] -= amount0;

        // withdraw token1
        require(i_token1.transfer(msg.sender, amount1), "Transfer Beta failed");
        tokenBalances[i_token1_address] -= amount1;
    }

    //测试不过，提示补充此函数
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
