import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import {Card, Tabs, Tab, Row, Col, Form, Button} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut,getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawingliquidity } from './utils/contract';      // Import helper functions

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
        
        await withdrawingliquidity(contracts, token0Amount);

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
      <header className="text-center mb-4">
        <Row className="align-items-center">
          <Col>
            <img src={Logo} alt="Logo" width="30" height="30" className="me-2" />
            <span className="h3">DEX Exchange</span>
          </Col>
          <Col className="text-end">
            {isWalletConnected ? (
              <div>
                <span className="me-3">Connected: {account?.substring(0, 6)}...{account?.substring(account.length - 4)}</span>
                <Button variant="outline-secondary" disabled>Connected</Button>
              </div>
            ) : (
              <Button variant="primary" onClick={handleConnectWallet}>Connect Wallet</Button>
            )}
          </Col>
        </Row>
      </header>

      <Row className="mb-4">
        <Col md={4} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Your Balances</Card.Title>
              <Card.Text>{balance0} ALPHA</Card.Text>
              <Card.Text>{balance1} BETA</Card.Text>
              <Card.Text>{balance2} GAMMA</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Pool Information</Card.Title>
              <Row>
                <Col md={4}>
                  <Card.Text>ALPHA: {poolInfo.token0Balance}</Card.Text>
                </Col>
                <Col md={4}>
                  <Card.Text>BETA: {poolInfo.token1Balance}</Card.Text>
                </Col>
                <Col md={4}>
                  <Card.Text>GAMMA: {poolInfo.token2Balance}</Card.Text>
                </Col>
              </Row>
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