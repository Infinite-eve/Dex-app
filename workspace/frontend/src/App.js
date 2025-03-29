import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import {Card, Tabs, Tab, Row, Col, Form, Button} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut,getContracts, getPoolInfo, getTokenBalances, getRequiredAmount1, swapTokens, addLiquidity, withdrawingliquidity } from './utils/contract';      // Import helper functions

function App() {
  /* wallet related */
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Track wallet connection
  const [account, setAccount] = useState(null);
	const [contracts, setContracts] = useState(null);
	const [provider, setProvider] = useState(null);

  /* balance related */
  const [balance0, setBalance0] = useState(0);
  const [balance1, setBalance1] = useState(0);
  const [poolInfo, setPoolInfo] = useState({ token0Balance: '0', token1Balance: '0' });

  /* swap related */
  const [fromToken, setFromToken] = useState('ALPHA');
  const [toToken, setToToken] = useState('BETA');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  /* add liquidity related */
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  
  /* withdraw liquidity related */
  // const [withdrawAmount1, setWithdrawAmount1] = useState('');
  // const [withdrawAmount2, setWithdrawAmount2] = useState('');
  
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
        const mappedTokenIn = tokenIn === 'ALPHA' ? 'token0' : 'token1';
        const mappedTokenOut = tokenOut === 'ALPHA' ? 'token0' : 'token1';

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
        const token1Amount = await calculateToken1Amount(value);
        setToken1Amount(token1Amount);
    } else {
        setToken1Amount('');
    }
  };

  const calculateToken1Amount = async (amount0) => {
      if (!amount0 || !contracts || isNaN(amount0) || amount0 <= 0) {
          return '0';
      }

      try {
          const result = await getRequiredAmount1(contracts, amount0);
          return result;
      } catch (error) {
          console.error("Error calculating token1 amount:", error);
          return '0';
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

        const tokenIn = fromToken === 'ALPHA' ? 'token0' : 'token1';
        const tokenOut = toToken === 'ALPHA' ? 'token0' : 'token1';

        await swapTokens(contracts, tokenIn, fromAmount, tokenOut);

        // update balance
        const balances = await getTokenBalances(contracts, account);
        setBalance0(balances.token0);
        setBalance1(balances.token1);

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

        await addLiquidity(contracts, token0Amount);

        // update balance
        const balances = await getTokenBalances(contracts, account);
        setBalance0(balances.token0);
        setBalance1(balances.token1);

        // update pool info
        const newPoolInfo = await getPoolInfo(contracts);
        setPoolInfo(newPoolInfo);

        alert("Liquidity added successfully!");
    } catch (error) {
        console.error("Detailed error:", error);
        alert(`Failed to add liquidity: ${error.message}`);
    }
  };

  // todo: infinite zhou: 确认
  const handleWithdrawLiquidity = async () => {
    try {
        if (!contracts || !account) {
            throw new Error("Contracts or account not initialized");
        }
        
        // @todo: infinite zhou: 
        await withdrawingliquidity(contracts, token0Amount);


        alert("Liquidity withdrawn successfully!");
    } catch (error) {
        console.error("Error withdrawing liquidity:", error);
        alert(`Failed to withdraw liquidity: ${error.message}`);
    }
  };
  
  return (
    <div className="App">
      <header className="App-header">
      <Card
        border="info"
        bg="dark"
        key="dark"
        text="white"
        style={{ width: "50rem"}}
        className="mb-2"
      >
      <Card.Body>
        <Card.Title>Liquidity Pool Balances</Card.Title>
        <Row>
        <Card.Text as={Col} >
          {poolInfo.token0Balance} ALPHA
        </Card.Text>
        <Card.Text as={Col}>
          {poolInfo.token1Balance} BETA
        </Card.Text>
        </Row>
      </Card.Body>
    </Card>

      <Card
        border="info"
        bg="dark"
        key="dark"
        text="white"
        style={{ width: "50rem", marginTop: "3rem" }}
        className="mb-2"
      >
        <Card.Img src={Logo} style={{padding:"2rem"}}/>
        <Card.ImgOverlay>
          <Card.Title style={{fontWeight:"bold", fontSize:"4rem",paddingTop:"2rem"}}>
            COMP5521 DeFi Swap
          </Card.Title>
          <Tabs
            defaultActiveKey="swap"
            className="mb-3"
            justify
          >
            <Tab eventKey="swap" title="Swap">
              <Form style={{padding:"1rem"}}>
              From
              <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                      <Form.Control 
                          size="lg"
                          type="number"
                          placeholder="0"
                          value={fromAmount}
                          min="0"
                          onChange={handleFromAmountChange}
                      />
                  </Col>
                  <Col>
                      <Form.Select
                          size="lg"
                          value={fromToken}
                          onChange={(e) => {
                              setFromToken(e.target.value);
                              if (e.target.value === toToken) {
                                  setToToken(fromToken);
                              }
                              setFromAmount('');
                              setToAmount('');
                          }}
                      >
                          <option value="ALPHA">ALPHA</option>
                          <option value="BETA">BETA</option>
                      </Form.Select>
                  </Col>
              </Row>
              <div style={{padding:'3rem', cursor: 'pointer'}} onClick={handleTokenSwitch}>
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="currentColor" class="bi bi-arrow-down-up" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5m-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5"/>
                </svg>
              </div>
                To
                <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                    <Form.Control size="lg"
                                      type="number"
                                      placeholder="0"
                                      value={toAmount}
                                      disabled
                    />
                  </Col>
                  <Col>
                  <Form.Select
                    size="lg"
                    value={toToken}
                    onChange={(e) => {
                        setToToken(e.target.value);
                        if (e.target.value === fromToken) {
                            setFromToken(toToken);
                        }
                        setFromAmount('');
                        setToAmount('');
                    }}
                    >
                      <option value="ALPHA">ALPHA</option>
                      <option value="BETA">BETA</option>
                    </Form.Select>
                  </Col>
                </Row>
              </Form>
                {!isWalletConnected ? (
                  <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet} block>
                    Connect Wallet
                  </Button>
                ) : (
                  <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleSwap} block>
                    Swap
                  </Button>
                )}
            </Tab>
            <Tab eventKey="liquidity" title="Provide Liquidity">
              <Form style={{padding:"1rem"}}>
                  <div>First Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control 
                              size="lg"
                              type="number"
                              placeholder="0"
                              value={token0Amount}
                              onChange={handleToken0AmountChange}
                              min="0"
                          />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="ALPHA">ALPHA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                  <div style={{padding:'1rem', textAlign: 'center'}}>
                      <span>+</span>
                  </div>
                  <div>Second Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control 
                              size="lg"
                              type="number"
                              placeholder="0"
                              value={token1Amount}
                              disabled
                          />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="BETA">BETA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                  {!isWalletConnected ? (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet}>
                          Connect Wallet
                      </Button>
                  ) : (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleAddLiquidity}>
                          Add Liquidity
                      </Button>
                  )}
              </Form>
            </Tab>
            <Tab eventKey="withdraw" title="Withdraw Liquidity">
                <Form style={{padding:"1rem"}}>
                    <div>First Token</div>
                    <Row style={{padding:"1rem"}}>
                        <Col xs={9}>
                            <Form.Control 
                                size="lg"
                                type="number"
                                placeholder="0"
                                value={token0Amount}
                                onChange={handleToken0AmountChange}
                                min="0"
                            />
                        </Col>
                        <Col>
                            <Form.Select size="lg" disabled>
                                <option value="ALPHA">ALPHA</option>
                                <option value="BETA">BETA</option>
                            </Form.Select>
                        </Col>
                    </Row>
                    <div style={{padding:'1rem', textAlign: 'center'}}>
                      <span>+</span>
                  </div>
                  <div>Second Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control size="lg" type="number" placeholder="0" value={token1Amount} disabled />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="BETA">BETA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                </Form>
                {!isWalletConnected ? (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet}>
                          Connect Wallet
                      </Button>
                  ) : (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleWithdrawLiquidity}>
                          Withdraw Liquidity
                      </Button>
                  )}
            </Tab>
          </Tabs>
        </Card.ImgOverlay>
	    </Card>
      {isWalletConnected && (
        <Card
            border="info"
            bg="dark"
            key="dark"
            text="white"
            style={{ width: "50rem", marginTop: "3rem"}}
            className="mb-2"
        >
          <Card.Body>
            <Card.Title> Your Wallet Balances</Card.Title>
            <Row>
            <Card.Text as={Col} >
              {balance0} ALPHA
            </Card.Text>
            <Card.Text as={Col}>
              {balance1} BETA
            </Card.Text>
            </Row>
          </Card.Body>
        </Card>
        )}
      </header>
    </div>
  );
}

export default App;