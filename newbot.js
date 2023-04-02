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

    const candleStick = await binanceClient.fetchOHLCV(market,'4h')
    const lastFiveCandleStick  = await candleStick.splice((candleStick.length - 5))


    
    const firstCS = await lastFiveCandleStick[4]
    const secondCS = await lastFiveCandleStick[3]
    const thirdCS = await lastFiveCandleStick[2]
    const fourthCS = await lastFiveCandleStick[1]
    const fifthCS = await lastFiveCandleStick[0]


    currentPrice = firstCS[4]
    let totalBUSD = busdBalance['BUSD']['total']

    let baseOrderAmount = ((0.15 * totalBUSD) * leverage)/ currentPrice
    let reUpdatedAmount = (initialMargin * leverage)/ currentPrice

    const previousHigh = secondCS[2]
    const previousLow = secondCS[3]
    const previousClose = secondCS[4]
    const previousOpen = secondCS[1]
    const previousTime = secondCS[0]

    const secPreviousHigh = thirdCS[2]
    const secPreviousLow = thirdCS[3]
    const secPreviousClose = thirdCS[4]
    const secPreviousOpen = thirdCS[1]
    
    const thirdPreviousHigh = fourthCS[2]
    const thirdPreviousLow = fourthCS[3]
    const thirdPreviousClose = fourthCS[4]
    const thirdPreviousOpen = fourthCS[1]

    const diffhilow = Math.abs(previousHigh - previousLow)
    const secDiffLoHi = Math.abs(secPreviousHigh - previousLow)
    const thirdDiffLoHi = Math.abs(thirdPreviousHigh - previousLow)


    let time = new Date().getTime()

    console.log(time);

    // trading algorithm 

    if (time > previousTime && time < (previousTime + 60000)) {
        if ((diffhilow > (0.0275 * currentPrice) && (previousClose < (previousLow + 300) || previousClose > (previousHigh - 300)))
        || (secDiffLoHi > (0.0375 * currentPrice)) || (thirdDiffLoHi > (0.052 * currentPrice)) ) {
            
            if (previousClose > previousOpen) {
                await binanceClient.createMarketSellOrder(market, baseOrderAmount)
    
               // place second order 
    
                await binanceClient.createLimitBuyOrder(market, baseOrderAmount , (currentPrice - 100))
    
    
                console.log(`
                    Market sell order placed at ${currentPrice}
                    Limit buy order  placed at ${currentPrice - 100}
                `);
            }
    
            if (previousOpen > previousClose) {
                await binanceClient.createMarketBuyOrder(market, baseOrderAmount)
    
               // place second order 
    
                await binanceClient.createLimitSellOrder(market, baseOrderAmount , (currentPrice + 100))
    
    
                console.log(`
                    Market buy order placed at ${currentPrice}
                    Limit sell order  placed at ${currentPrice - 100}
                `);
            }
        }     
    }




   

 
  



 

}



const run = () => {


    const config = {
        market: "BTCBUSD",
        allocation : 0.2,
        spread : 50,
        tickInterval: 60000,
        leverage: 75
    }

    const binanceClient = new ccxt.binanceusdm({
        apiKey: process.env.API_KEY,
        secret: process.env.API_SECRET,
    })

    tick(config, binanceClient)
    setInterval(tick, config.tickInterval, config, binanceClient)
}




run()