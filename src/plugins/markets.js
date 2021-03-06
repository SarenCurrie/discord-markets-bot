const yahooFinance = require('yahoo-finance');
const https = require('https');

const CACHE_TIME = 5 * 60 * 1000;

const DEFAULT_GROUPS = {
  crypto: {
    heading: 'Cryptocurrencies',
    currency: 'USD',
    source: 'coinmarketcap',
    securities: {
      bitcoin: {
        symbol: 'bitcoin',
        icon: '<:BTC:350872732747038721>',
        source: 'coinmarketcap',
      },
      ether: {
        symbol: 'ethereum',
        icon: '<:ETH:350872707258122241>',
        source: 'coinmarketcap',
      },
      litecoin: {
        symbol: 'litecoin',
        icon: '<:LTC:385590255417425930>',
        source: 'coinmarketcap',
      },
      dogecoin: {
        symbol: 'dogecoin',
        icon: '<:DOGE:350872665055166464>',
        source: 'coinmarketcap',
      },
      monero: {
        symbol: 'monero',
        icon: '<:XMR:385629714334613505>',
        source: 'coinmarketcap',
      },
      ripple: {
        symbol: 'ripple',
        icon: '<:XRP:397950304525746190>',
        source: 'coinmarketcap',
      },
      bitcoinCash: {
        symbol: 'bitcoin-cash',
        icon: '<:BCH:397951148729958400>',
        source: 'coinmarketcap',
      },
    },
  },
  us_tech: {
    heading: 'US Tech Overlords',
    currency: 'USD',
    source: 'yahoo',
    securities: {
      amazon: {
        symbol: 'AMZN',
        icon: '<:amazon:397952662097756170>',
        source: 'yahoo',
      },
      apple: {
        symbol: 'AAPL',
        icon: '<:applecomputer:397921162904207360>',
        source: 'yahoo',
      },
      google: {
        symbol: 'GOOG',
        icon: '<:google:397951281504976897>',
        source: 'yahoo',
      },
      microsoft: {
        symbol: 'MSFT',
        icon: '<:microsoft:397954074722697216>',
        source: 'yahoo',
      },
      facebook: {
        symbol: 'FB',
        icon: '<:facebook:425448532166574091>',
        source: 'yahoo',
      },
    },
  },
  currency: {
    heading: 'Currencies',
    currency: 'NZD',
    source: 'yahoo',
    securities: {
      aud: {
        symbol: 'AUDNZD=X',
        icon: ':flag_au:',
        source: 'yahoo',
      },
      usd: {
        symbol: 'NZD=X',
        icon: ':flag_us:',
        source: 'yahoo',
      },
      gbp: {
        symbol: 'GBPNZD=X',
        icon: ':flag_gb:',
        source: 'yahoo',
      },
    },
  },
};

const getSortPriority = (text, groups) => {
  const groupName = text.match(/\*\*([^*]*)\*\*/)[1];
  return Object.values(groups).findIndex(g => g.heading === groupName);
};

const yahooCache = {};
const cmcCache = {};

const getFromYahooCache = (symbol) => {
  if (yahooCache[symbol] && yahooCache[symbol].expiry > Date.now()) {
    return Promise.resolve(yahooCache[symbol].value);
  }
  return yahooFinance.quote({ symbol, modules: ['price', 'summaryDetail'] }).then((result) => {
    yahooCache[symbol] = {
      value: result,
      expiry: Date.now() + CACHE_TIME,
    };

    return result;
  });
};

const getFromCmcCache = (symbol) => {
  if (cmcCache[symbol] && cmcCache[symbol].expiry > Date.now()) {
    return Promise.resolve(cmcCache[symbol].value);
  }
  return new Promise((resolve, reject) => {
    https.get(`https://api.coinmarketcap.com/v1/ticker/${symbol}/`, (res) => {
      let data = '';

      // A chunk of data has been recieved.
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      res.on('end', () => {
        const result = JSON.parse(data);

        cmcCache[symbol] = {
          value: result,
          expiry: Date.now() + CACHE_TIME,
        };

        resolve(result);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

const getTrend = (quote) => {
  const change = quote.change || quote.price - quote.close;
  if (change > 0) {
    return ':chart_with_upwards_trend:';
  } else if (change < 0) {
    return ':chart_with_downwards_trend:';
  }
  return ':expressionless:';
};

const MAX_WIDTH = 5;
const addSpace = price => `${' '.repeat(MAX_WIDTH - Math.floor(Math.max(Math.log10(price), 0) + 1))}${price.toFixed(4)}`;

const getYahooPricesForGroup = group => new Promise((resolve, reject) => {
  const getIcon = symbol => Object.values(group.securities).find(s => s.symbol === symbol).icon;
  Promise.all(Object.values(group.securities).map(security => getFromYahooCache(security.symbol)))
  .then((quotes) => {
    resolve(quotes.map(q => ({
      symbol: q.price.symbol,
      price: q.price.regularMarketPrice,
      close: q.price.regularMarketPreviousClose,
      cap: q.summaryDetail.marketCap,
      change: q.price.regularMarketChangePercent * 100,
    }))
    .sort((a, b) => b.cap - a.cap)
    .map(q =>
        `${getIcon(q.symbol) || q.symbol}: \`$${q.price.toFixed(2)} ${group.currency}\` ${getTrend(q)} \`${Math.abs(q.change).toFixed(2)}%\``)
    .reduce((a, b) => `${a}\n\t${b}`, `**${group.heading}**`));
  }).catch(err => reject(err));
});

const getCoinMarketCapPricesForGroup = group => new Promise((resolve, reject) => {
  const getIcon = symbol => Object.values(group.securities).find(s => s.symbol === symbol).icon;
  Promise.all(Object.values(group.securities).map(security => getFromCmcCache(security.symbol)))
  .then((quotes) => {
    resolve(quotes.map(q => ({
      symbol: q[0].id,
      price: parseFloat(q[0].price_usd),
      close: parseFloat(q[0].price_usd),
      cap: parseFloat(q[0].market_cap_usd),
      change: parseFloat(q[0].percent_change_24h),
    }))
    .sort((a, b) => b.cap - a.cap)
    .map(q => `${getIcon(q.symbol) || q.symbol}: \`$${addSpace(q.price)} ${group.currency}\` ${getTrend(q)} \`${Math.abs(q.change).toFixed(2)}%\``)
    .reduce((a, b) => `${a}\n\t${b}`, `**${group.heading}**`));
  }).catch(err => reject(err));
});

const getYahooPrices = securities => Promise.all(securities.map(group => getYahooPricesForGroup(group)));
const getCoinMarketCapPrices = securities => Promise.all(securities.map(group => getCoinMarketCapPricesForGroup(group)));

const getPrices = securities => Promise.all([
  getYahooPrices(securities.filter(group => group.source === 'yahoo')),
  getCoinMarketCapPrices(securities.filter(group => group.source === 'coinmarketcap')),
]);

const all = groups => getPrices(Object.values(groups));
const single = (name, groups) =>
    (groups[name] ? getPrices([groups[name]]) :
    Promise.reject(`Do not have a group called ${name}. Try one of these: ${Object.keys(groups).reduce((a, b) => `${a}, ${b}`)}`));

const formatResult = (result, groups) => result
  .reduce((a, b) => a.concat(b), []) // Flatten
  .sort((a, b) => getSortPriority(a, groups) - getSortPriority(b, groups))
  .reduce((a, b) => `${a}\n\n${b}`);

module.exports = (settings) => {
  const groups = settings.groups || DEFAULT_GROUPS;
  const init = (app) => {
    app.addMessageTrigger(/^!markets\s?(.*)$/, (opts) => {
      let query;
      if (opts.matches[1] !== '') {
        query = single(opts.matches[1], groups);
      } else {
        query = all(groups);
      }
      query.then(prices => opts.bot.sendMessage({
        to: opts.channelId,
        message: formatResult(prices, groups),
      })).catch(err => {
        console.error(err);
        opts.bot.sendMessage({
          to: opts.channelId,
          message: `SCRIPT CRASH! ${err}`,
        });
      });
    });

    if (settings.dailyUpdateChannel && settings.dailyUpdateTime) {
      app.addCronTrigger(settings.dailyUpdateTime, bot => all(groups).then(prices => bot.sendMessage({
        to: settings.dailyUpdateChannel,
        message: formatResult(prices, groups),
      })).catch(err => bot.sendMessage({
        to: settings.dailyUpdateChannel,
        message: `SCRIPT CRASH! ${err}`,
      })));
    }
  };

  return { init };
};
