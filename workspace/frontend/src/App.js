import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import { Card, Tabs, Tab, Row, Col, Form, Button,Container, Badge,Table} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut, getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawingliquidity } from './utils/contract';      // Import helper functions

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
  // const [withdrawAmount1, setWithdrawAmount1] = useState('');
  // const [withdrawAmount2, setWithdrawAmount2] = useState('');

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

  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      const initializedContracts = await getContracts(signer);

      setProvider(provider);
      setAccount(accounts[0]);
      setContracts(initializedContracts);
      setIsWalletConnected(true);

      // get balance
      const balances = await getTokenBalances(initializedContracts, accounts[0]);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // get pool info
      const info = await getPoolInfo(initializedContracts);
      setPoolInfo(info);

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

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts);
      setPoolInfo(newPoolInfo);

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

      // todo: @infinite-zhou 先写死,可能之后需要改

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

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts);
      setPoolInfo(newPoolInfo);

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

      await withdrawingliquidity(contracts, addresses_token, amounts_list);

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts);
      setPoolInfo(newPoolInfo);

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
              <Card.Text>ALPHA：{balance0} </Card.Text>
              <Card.Text>BETA： {balance1} </Card.Text>
              <Card.Text>GAMMA： {balance2} </Card.Text>
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
                    <th colSpan="7">Basic Pool Information</th>
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
                    <th>User LP Tokens</th>
                    <th>User Total Value</th>
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
                    <tr >
                      <td>\</td>
                      <td>\</td>
                      <td>{poolInfo.token0Balance}</td>
                      <td>{poolInfo.token1Balance}</td>
                      <td>{poolInfo.token2Balance}</td>
                      <td>\</td>
                      <td>\</td>
                      <td>\</td>
                      <td>\</td>
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
                      placeholder="0.0"
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
                      value={toAmount}
                      readOnly
                      placeholder="0.0"
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
                    placeholder="0.0"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>BETA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={token1Amount}
                    readOnly
                    placeholder="0.0"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>GAMMA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={token2Amount}
                    readOnly
                    placeholder="0.0"
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
                  <Form.Label>ALPHA Amount to Withdraw</Form.Label>
                  <Form.Control
                    type="number"
                    value={token0Amount}
                    onChange={handleToken0AmountChange}
                    placeholder="0.0"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>BETA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={token1Amount}
                    readOnly
                    placeholder="0.0"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>GAMMA Amount (calculated automatically)</Form.Label>
                  <Form.Control
                    type="number"
                    value={token2Amount}
                    readOnly
                    placeholder="0.0"
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={handleWithdrawLiquidity}
                  disabled={!isWalletConnected || !token0Amount || token0Amount <= 0}
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