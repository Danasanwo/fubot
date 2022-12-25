const ccxt = require('ccxt')
require('dotenv').config()
const { config } = require('dotenv')

const tick = async(config, binanceClient) => {
    const { market, spread, allocation, leverage} = config

    // get order data 
    const closedOrders = await binanceClient.fetchClosedOrders(market)
    const openOrders = await binanceClient.fetchOpenOrders(market)
    const lastCompletedOrder = await closedOrders[(closedOrders.length - 1)]
    const busdBalance = await binanceClient.fetchBalance()
    const positions = await  binanceClient.fetchPositions([market])
    let currentPrice 
    const { entryPrice, liquidationPrice, initialMargin, side, contracts, collateral } = await positions[0]
   

    // get candleStick data 

    const candleStick = await binanceClient.fetchOHLCV(market,'30m')
    const lastFiveCandleStick  = await candleStick.splice((candleStick.length - 5))


    
    const firstCS = await lastFiveCandleStick[4]
    const secondCS = await lastFiveCandleStick[3]
    const thirdCS = await lastFiveCandleStick[2]
    const fourthCS = await lastFiveCandleStick[1]
    const fifthCS = await lastFiveCandleStick[0]

    let candleUpCounter = 0
    let candleDownCounter = 0
    currentPrice = firstCS[4]

    let loopCounter = 0;
    let stickDirection = []
    let recentDirection 


    lastFiveCandleStick.forEach(e => {
        let open =  e[1]
        let high = e[2]
        let low =   e[3]
        let close =  e[4]

        loopCounter = loopCounter + 1

        // computational 

        if (open > close) {
            if ((high - open ) > (close - low)) {
                candleDownCounter = candleDownCounter + 1

                stickDirection[loopCounter - 1] = "down"

            }
            if ((high - open ) < (close - low)) {
                candleUpCounter = candleUpCounter + 1

                stickDirection[loopCounter - 1] = "up"

            }
        }

        if (open < close) {
            if ((high - close ) > (open - low)) {
                candleDownCounter = candleDownCounter + 1

                stickDirection[loopCounter - 1] = "down"

            }
            if ((high - close ) < (open - low)) {
                candleUpCounter = candleUpCounter+ 1

                stickDirection[loopCounter - 1] = "up"
            }
        }
        
    });

    // console.log(candleUpCounter, candleDownCounter );
    // console.log(stickDirection);

    recentDirection = stickDirection[4]

    // console.log(recentDirection);
    // console.log(currentPrice);
    // console.log(entryPrice);
    // console.log(contracts);
    // console.log(side);
    // console.log(busdBalance['BUSD']['total']);

    // console.log(openOrders); 

    let totalBUSD = busdBalance['BUSD']['total']

    let baseOrderAmount = ((0.05 * totalBUSD) * leverage)/ currentPrice
    let reUpdatedAmount = (initialMargin * leverage)/ currentPrice

    // console.log(positions);

    

    // trading algorithm 

    // if existing position 

    if (initialMargin > 0 && contracts > 0 ) {
        
        if (openOrders.length < 7) {
            if (side == 'short') {
                // cancel current buy order 

                openOrders.forEach(async e => {
                    if (e.side == 'buy'){
                        await binanceClient.cancelOrder(e.id, market)
                    }
                });

                // place new order 
                await binanceClient.createLimitBuyOrder(market, reUpdatedAmount, (entryPrice - 30))

                console.log(`placed new limit buy order at ${(entryPrice - 30)} `);
                }
            if (side == 'long') {
                  // cancel current sell order 

                  openOrders.forEach(async e => {
                    if (e.side == 'sell'){
                        await binanceClient.cancelOrder(e.id, market)
                    }
                });

                // place new order 
                await binanceClient.createLimitSellOrder(market, reUpdatedAmount, (entryPrice + 30))

                console.log(`placed new limit sell order at ${(entryPrice + 30)} `);
                
            }
        }

        if (openOrders.length < 2) {

            // cancel the existing order 
            await  binanceClient.cancelAllOrders(market)

            // place new order 

            if (side == 'short') {
                await binanceClient.createLimitBuyOrder(market, reUpdatedAmount, (entryPrice - 30))

                console.log(`placed new limit buy order at ${(entryPrice - 30)} `);
                }
            if (side == 'long') {
                await binanceClient.createLimitSellOrder(market, reUpdatedAmount, (entryPrice + 30))
                console.log(`placed new limit sell order at ${(entryPrice + 30)} `);
            }

        }


        if (collateral < (0.55 * initialMargin)) {
            if (side == 'short') {
            await binanceClient.createMarketOrder(market, "buy", contracts)
            }
            if (side == 'long') {
                await binanceClient.createMarketOrder(market, "sell", contracts)
            }
        }

        if (openOrders.length > 1) {
            console.log("let's go again");
        }

    }

    if (initialMargin == 0 && contracts == 0) {

        // first is cancel all orders 

        await  binanceClient.cancelAllOrders(market)


        // then place new orders 

        if (recentDirection == 'down' && candleDownCounter > 2) {
            
            // place first order 

            await binanceClient.createMarketSellOrder(market, (baseOrderAmount * 2))

            // place second order 

            await binanceClient.createLimitBuyOrder(market, (baseOrderAmount * 2), (currentPrice - 30))

            // place backup orders

            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 25))
            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 50))
            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 75))
            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 100))
            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 150))
            await binanceClient.createLimitSellOrder(market, baseOrderAmount, (currentPrice + 200))


            console.log(`
                Market sell order placed at ${currentPrice}
                Limit buy order  placed at ${currentPrice - 30}
                Limit sell order placed at ${currentPrice + 25}
                Limit sell order placed at ${currentPrice + 50}
                Limit sell order placed at ${currentPrice + 75}
                Limit sell order placed at ${currentPrice + 100}
                Limit sell order placed at ${currentPrice + 150}
                Limit sell order placed at ${currentPrice + 200}
            `);
        

        }
    
        if (recentDirection == 'up' && candleUpCounter > 2) {
            // place first order 

            await binanceClient.createMarketBuyOrder(market, (baseOrderAmount * 2))

            // place second order 

            await binanceClient.createLimitSellOrder(market, (baseOrderAmount * 2), (currentPrice + 30))

            // place backup order 

            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 25))
            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 50))
            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 75))
            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 100))
            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 150))
            await binanceClient.createLimitBuyOrder(market, baseOrderAmount, (currentPrice - 200))

            console.log(`
                Market buy order placed at ${currentPrice}
                Limit sell order  placed at ${currentPrice + 30}
                Limit buy order placed at ${currentPrice - 25}
                Limit buy order placed at ${currentPrice - 50}
                Limit buy order placed at ${currentPrice - 75}
                Limit buy order placed at ${currentPrice - 100}
                Limit buy order placed at ${currentPrice - 150}
                Limit buy order placed at ${currentPrice - 200}
            `);        
        }

        if ((recentDirection == 'down' && candleDownCounter <= 2) || (recentDirection == 'up' && candleUpCounter <= 2)) {
            console.log("we go again");
        }
    }
}



const run = () => {

    const config = {
        market: "BTCBUSD",
        allocation : 0.2,
        spread : 50,
        tickInterval: 150000,
        leverage: 30
    }

    const binanceClient = new ccxt.binanceusdm({
        apiKey: process.env.API_KEY,
        secret: process.env.API_SECRET,
    })


   
  
   

    tick(config, binanceClient)
    setInterval(tick, config.tickInterval, config, binanceClient)
}




run()