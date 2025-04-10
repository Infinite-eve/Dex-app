import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import { Card, Tabs, Tab, Row, Col, Form, Button,Container, Badge,Table} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut, getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawLiquidity, getLPTokenInfo} from './utils/contract';      // Import helper functions

// 添加格式化数字的辅助函数
const formatNumber = (number) => {
  if (!number || isNaN(number)) return '0.00';
  // 确保number是数字类型
  const num = typeof number === 'string' ? parseFloat(number) : number;
  if (isNaN(num)) return '0.00';
  // 处理非常小的数字，使用科学计数法
  if (num < 0.000001 && num > 0) {
    return num.toExponential(6);
  }
  // 正常数字保留2位小数
  return num.toFixed(2);
};

function App() {
  /* wallet related */
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Track wallet connection
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [provider, setProvider] = useState(null);

  /* balance related */
  const [balance0, setBalance0] = useState(0);
  const [balance1, setBalance1] = useState(0);
  const [balance2, setBalance2] = useState(0);
  const [poolInfo, setPoolInfo] = useState({ token0Balance: '0', token1Balance: '0', token2Balance: '0' });
  const [lpInfo, setLpInfo] = useState({ totalSupply: '0', userBalance: '0' });

  /* swap related */
  // todo: @infinite-zhou 确定一下useState是不是
  const [fromToken, setFromToken] = useState('ALPHA');
  const [toToken, setToToken] = useState('BETA');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  /* add liquidity related */
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  const [token2Amount, setToken2Amount] = useState('');

  /* withdraw liquidity related */
  const [lpTokenAmount, setLpTokenAmount] = useState('');

  // 所有支持的代币
  const supportedTokens = ['ALPHA', 'BETA', 'GAMMA'];

  /*获取poollist*/
  // const PoolList = () => {
  //   return (
  //     <div>
  //       {pools.map((pool) => (
  //         <div key={pool.id} className="pool-card">
  //           <h3>Pool #{pool.id}: {pool.pair}</h3>
  //           <div>
  //             <p><strong>Token0 Balance:</strong> {pool.token0Balance}</p>
  //             <p><strong>Token1 Balance:</strong> {pool.token1Balance}</p>
  //             <p><strong>Total LP Tokens:</strong> {pool.totalLPToken}</p>
  //             <p><strong>Fee:</strong> {pool.fee}</p>
  //           </div>
  //           <div>
  //             <p><strong>Your LP Tokens:</strong> {pool.userLPToken}</p>
  //             <p><strong>Your Total Value:</strong> ${pool.userValue}</p>
  //           </div>
  //         </div>
  //       ))}
  //     </div>
  //   );
  // };

  // switch token button
  const handleTokenSwitch = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
  };

  const calculateOutputAmount = async (inputAmount, tokenIn, tokenOut) => {

    if (!inputAmount || !contracts || !tokenIn || !tokenOut) {
      return '0';
    }

    try {
      const mappedTokenIn = tokenIn === 'ALPHA' ? 'token0' : (tokenIn === 'BETA' ? 'token1' : 'token2');
      const mappedTokenOut = tokenOut === 'ALPHA' ? 'token0' : (tokenOut === 'BETA' ? 'token1' : 'token2');

      const result = await getAmountOut(
        contracts,
        mappedTokenIn,
        inputAmount,
        mappedTokenOut
      );
      return result;
    } catch (error) {
      console.error("Error calculating output amount:", error);
      return '0';
    }
  };

  const handleFromAmountChange = async (e) => {
    const value = e.target.value;
    setFromAmount(value);

    if (value && !isNaN(value)) {
      const output = await calculateOutputAmount(value, fromToken, toToken);
      setToAmount(output);
    } else {
      setToAmount('');
    }
  };

  const handleToken0AmountChange = async (e) => {
    const value = e.target.value;
    setToken0Amount(value);

    if (value && !isNaN(value)) {
      const [token1Amount, token2Amount] = await calculateTokenAmounts(value);
      setToken1Amount(token1Amount);
      setToken2Amount(token2Amount);
    } else {
      setToken1Amount('');
      setToken2Amount('');
    }
  };

  const calculateTokenAmounts = async (amount0) => {
    if (!amount0 || !contracts || isNaN(amount0) || amount0 <= 0) {
      return ['0', '0'];
    }
    try {
      console.log(amount0);
      const result = await getRequiredAmounts(contracts, amount0);
      const subArray = result.slice(1);
      console.log(subArray.map(item => ethers.formatEther(item)));

      return subArray.map(item => ethers.formatEther(item));
    } catch (error) {
      console.error("Error calculating token amounts:", error);
      return ['0', '0'];
    }
  };

  const updatePoolAndBalances = async () => {
    if (!contracts || !account) return;
    
    // 获取用户代币余额
    const balances = await getTokenBalances(contracts, account);
    setBalance0(balances.token0);
    setBalance1(balances.token1);
    setBalance2(balances.token2);

    // 获取池子信息
    const info = await getPoolInfo(contracts);
    setPoolInfo(info);

    // 获取LP token信息
    const lpTokenInfo = await getLPTokenInfo(contracts, account);
    setLpInfo(lpTokenInfo);
  };

  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      // 先设置合约
      const initializedContracts = await getContracts(signer);
      console.log("Contracts initialized");

      // 设置状态
      setProvider(provider);
      setAccount(accounts[0]);
      setContracts(initializedContracts);
      setIsWalletConnected(true);

      // 立即获取余额信息
      const balances = await getTokenBalances(initializedContracts, accounts[0]);
      console.log("Token balances:", balances);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // 获取池子信息
      const info = await getPoolInfo(initializedContracts);
      console.log("Pool info:", info);
      setPoolInfo(info);

      // 获取LP token信息
      const lpTokenInfo = await getLPTokenInfo(initializedContracts, accounts[0]);
      console.log("LP token info:", lpTokenInfo);
      setLpInfo(lpTokenInfo);

      alert(`Wallet connected!`);
    } catch (error) {
      console.error("Detailed connection error:", error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleSwap = async () => {
    try {
      if (!contracts) return;

      const tokenIn = fromToken === 'ALPHA' ? 'token0' : (fromToken === 'BETA' ? 'token1' : 'token2');
      const tokenOut = toToken === 'ALPHA' ? 'token0' : (toToken === 'BETA' ? 'token1' : 'token2');

      await swapTokens(contracts, tokenIn, fromAmount, tokenOut);

      // 更新所有信息
      await updatePoolAndBalances();

      alert('Swap completed successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to swap tokens');
    }
  };

  const handleAddLiquidity = async () => {
    try {
      if (!contracts || !account) {
        throw new Error("Contracts or account not initialized");
      }

      const amounts_list = [
        ethers.parseEther(token0Amount.toString()),
        ethers.parseEther(token1Amount.toString()),
        ethers.parseEther(token2Amount.toString())
      ];

      const addresses_token = [
        contracts.token0.address,
        contracts.token1.address,
        contracts.token2.address,
      ];

      await addLiquidity(contracts, addresses_token, amounts_list);

      // 更新所有信息
      await updatePoolAndBalances();

      alert("Liquidity added successfully!");
    } catch (error) {
      console.error("Detailed error:", error);
      alert(`Failed to add liquidity: ${error.message}`);
    }
  };

  const handleWithdrawLiquidity = async () => {
    try {
      if (!contracts || !account) {
        throw new Error("Contracts or account not initialized");
      }

      if (!lpTokenAmount) {
        throw new Error("Please enter valid LP token amount");
      }

      const lpTokenAmountWei = ethers.parseEther(formatNumber(lpTokenAmount));
      await withdrawLiquidity(contracts, lpTokenAmountWei);

      // 清空输入框
      setLpTokenAmount('');

      // 更新所有信息
      await updatePoolAndBalances();

      alert("Liquidity withdrawn successfully!");
    } catch (error) {
      console.error("Detailed error:", error);
      alert(`Failed to withdraw liquidity: ${error.message}`);
    }
  };

  return (
    <div className="container py-5">
      <nav className="bg-light py-3 shadow-sm"> 
        <Container>
          <Row className="justify-content-center align-items-center g-0">
            <Col className="col-auto"> 
              <div className="d-flex align-items-center justify-content-center"> 
                <img
                  src={Logo}
                  alt="Logo"
                  width="36"
                  height="36"
                  className="me-2"
                />
                <span className="h4 mb-0 text-primary">DEX APP</span>
              </div>
            </Col>

            {/* 右侧 - 钱包连接按钮 */}
            <Col className="col-auto ms-auto"> 
              {isWalletConnected ? (
                <div className="d-flex align-items-center gap-2">
                  <Badge pill bg="secondary" className="fs-6 py-2">
                    {`${account?.slice(0, 6)}...${account?.slice(-4)}`}
                  </Badge>
                  <Button 
                    variant="outline-primary"
                    onClick={updatePoolAndBalances}
                    size="sm"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Refresh
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleConnectWallet}
                  size="lg"
                  className="px-4"
                >
                  Connect Wallet
                </Button>
              )}
            </Col>
          </Row>
        </Container>
      </nav>
      
      {/* 个人账户余额 */}
      <Row className="mb-4">
        <Col md={2} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="Card-title">Balances</Card.Title>
              <Card.Text>ALPHA：{formatNumber(balance0)} </Card.Text>
              <Card.Text>BETA： {formatNumber(balance1)} </Card.Text>
              <Card.Text>GAMMA： {formatNumber(balance2)} </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        {/* PoolList */}
        <Col md={10} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="Card-title">Pool Information</Card.Title>
              <Table striped bordered hover>
                <thead>
                  <tr className="table-primary">
                    <th colSpan="8">Basic Pool Information</th>
                    <th colSpan="2">User Holder</th>
                  </tr>
                  <tr>
                    <th>#</th>
                    <th>Pair</th>
                    <th>Token0 Balance</th>
                    <th>Token1 Balance</th>
                    <th>Token3 Balance</th>
                    <th>Total LP Tokens</th>
                    <th>Fee</th>
                    <th>lpFees</th>
                    <th>User Total Value</th>
                    <th>Share Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {/* TODO:待有list后补充 
                   {pools.map((pool) => (
                    <tr key={pool.id}>
                      <td>{pool.id}</td>
                      <td>{pool.pair}</td>
                      <td>{pool.token0Balance}</td>
                      <td>{pool.token1Balance}</td>
                      <td>{pool.totalLPToken}</td>
                      <td>{pool.fee}</td>
                      <td>{pool.userLPToken}</td>
                      <td>${pool.userValue}</td>
                    </tr>
                  ))} */}
                    <tr>
                      <td>\</td>
                      <td>ALPHA-BETA-GAMMA</td>
                      <td>{formatNumber(poolInfo.token0Balance)}</td>
                      <td>{formatNumber(poolInfo.token1Balance)}</td>
                      <td>{formatNumber(poolInfo.token2Balance)}</td>
                      <td>{formatNumber(lpInfo.totalSupply)}</td>
                      <td>0.3%</td>
                      <td>暂无</td>
                      <td>{formatNumber(lpInfo.userBalance)}</td>
                      <td>{lpInfo.percentage}%</td>
                    </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="swap" className="mb-3">
            <Tab eventKey="swap" title="Swap">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>From</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={fromAmount}
                      onChange={handleFromAmountChange}
                      placeholder="0.00"
                      step="0.01"
                      className="me-2"
                    />
                    <Form.Select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map(token => (
                        token !== toToken && (
                          <option key={token} value={token}>{token}</option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                <div className="text-center my-3">
                  <Button variant="outline-secondary" onClick={handleTokenSwitch}>
                    ↑↓
                  </Button>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>To</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={formatNumber(toAmount)}
                      readOnly
                      placeholder="0.00"
                      className="me-2"
                    />
                    <Form.Select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map(token => (
                        token !== fromToken && (
                          <option key={token} value={token}>{token}</option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={handleSwap}
                  disabled={!isWalletConnected || !fromAmount || fromAmount <= 0}
                >
                  Swap
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="liquidity" title="Add Liquidity">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>ALPHA Amount</Form.Label>
                  <Form.Control
                    type="number"
                    value={token0Amount}
                    onChange={handleToken0AmountChange}
                    placeholder="0.00"
                    step="0.01"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>BETA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={formatNumber(token1Amount)}
                    readOnly
                    placeholder="0.00"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>GAMMA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={formatNumber(token2Amount)}
                    readOnly
                    placeholder="0.00"
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={handleAddLiquidity}
                  disabled={!isWalletConnected || !token0Amount || token0Amount <= 0}
                >
                  Add Liquidity
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="withdraw" title="Withdraw Liquidity">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>LP Token Amount to Withdraw</Form.Label>
                  <Form.Control
                    type="number"
                    value={lpTokenAmount}
                    onChange={(e) => setLpTokenAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={handleWithdrawLiquidity}
                  disabled={!isWalletConnected || !lpTokenAmount || lpTokenAmount <= 0}
                >
                  Withdraw Liquidity
                </Button>
              </Form>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
}

export default App;