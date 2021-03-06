(function(){
	function EthUtil(web3, ethAbi) {
		const _web3 = web3;
		const _ethAbi = ethAbi;
		const _self = this;

		// current state and promise for current state
		const _DEFAULT_STATE = {
			isConnected: false,
			account: null,
			networkId: null,
			latestBlock: {number: null}
		};
		var _isInitialized;
		var _curState = {latestBlock: {}};
		var _curStatePromise = null;
		const _stateChangeCallbacks = [];

		this.NO_ADDRESS = "0x0000000000000000000000000000000000000000";

		// this value is updated every 2 seconds.
		this.getCurrentState = function(fresh){
			// update the _curState value every 2 seconds
			function updateCurrentState(){
				return Promise.resolve(_self.getBlock('latest'))
					.then(block=>{
						return {
							isConnected: true,
							account: web3.eth.accounts[0],
							networkId: web3.version.network,
							latestBlock: block,
						}
					}).catch(() => {
						return _DEFAULT_STATE;
					}).then(newState => {
						// for for any differences, and call the callbacks
						const anyChange = Object.keys(newState).some(state=>{
							return state=="latestBlock"
								? newState[state].number!==_curState[state].number
								: newState[state]!==_curState[state];
						})
						_curState = newState;
						_isInitialized = true;

						if (anyChange){
							try { _stateChangeCallbacks.forEach(cb => cb(newState)); }
							catch(e){ console.error("Callback Threw: ", e); }
						}
						return _curState;
					});
			};
		
			if (fresh) {
				if (_curStatePromise) {
					return _curStatePromise;
				} else {
					_curStatePromise = updateCurrentState();
					const reset = ()=>_curStatePromise=null;
					Promise.resolve(_curStatePromise).then(reset, reset);
					return _curStatePromise;
				}
			} else {
				return Promise.resolve(_curState);
			}
		};

		this.pollForStateChange = function(timeMs){
			(function pollState() {
				timeMs = timeMs || 2000;
				const wait = ()=>setTimeout(pollState, timeMs);
				_self.getCurrentState(true).then(wait, wait);
			}());
		};

		this.onStateChanged = function(cb){
			_stateChangeCallbacks.push(cb);
			if (_isInitialized) setTimeout(()=>cb(_curState), 0);
		};

		this.getToday = function(){
			return new BigNumber(Math.floor(_curState.latestBlock.timestamp / (60*60*24)));
		};
		this.getCurrentBlockHeight = function(){
			// returns BigNumber
			return new BigNumber(_curState.latestBlock.number);
		}
		this.getCurrentBlockTime = function(){
			// returns BigNubmer
			return new BigNumber(_curState.latestBlock.timestamp);
		}
		this.getCurrentAccount = function(required){
			if (required) {
				if (!_curState.account || _curState.account===_self.NO_ADDRESS)
					throw new Error("There is no account, and one is required.");
			}
			return _curState.account;
		}

		// decodes event, or returns null if no matching topic in abi
		this.decodeEvent = function(event, abi) {
			// find corresponding ABI entry
			const def = abi.find((abi)=>{
				return (abi.type === 'event' && 
					event.topics[0].startsWith(_ethAbi.encodeSignature(abi)));
			});
			if (!def){
				console.error("No matching event name for this topic.", event.topics[0], abi);
				return null;
			}
			// update the event to have nice names.
			event.name = def['name'];
			event.blockNumber = (new BigNumber(event.blockNumber)).toNumber();
			event.logIndex = (new BigNumber(event.logIndex)).toNumber();
			event.transactionIndex = (new BigNumber(event.transactionIndex)).toNumber();
			try {
				event.args = _ethAbi.decodeEvent(def, event.data, event.topics, false);
				delete event.data;
			} catch (e){
				console.error("Failed to decode event:", event, "With abi:", def);
				return null;
			}
			return event;
		};

		this.getEventSignature = function(eventDef) {
			const name = eventDef.name;
			const types = eventDef.inputs.map(input=>input.type);
			const str = `${name}(${types.join(',')})`;
			return web3.sha3(str);
		}
		this.toBytesStr = function(num, bytes) {
            const targetLen = Math.ceil(bytes * 2);
            var hexStr = num.toString(16);
            if (hexStr.startsWith("0x")) hexStr = hexStr.slice(2);
            if (hexStr.length > targetLen)
                throw new Error(`Cannot convert ${num} to bytes${bytes}, it's too large.`);
            const zeroes = (new Array(targetLen-hexStr.length+1)).join("0");
            return `${zeroes}${hexStr}`;
		}

		// does a low-level JSON RPC call with provided method/params
		this.sendAsync = function(method, params){
	        return new Promise((res,rej)=>{
	        	const obj = {
		            jsonrpc: "2.0",
		            method: method,
		            params: params,
		            id: new Date().getTime() + Math.round(Math.random()*1e12)
		        };
	        	_web3.currentProvider.sendAsync(obj, function(err, result){
		        	if (err) rej(err);
		        	if (result.error) rej(new Error(result.error.message));
		        	else res(result.result);
		        });
	        }).catch(e=>{
	        	const paramsStr = JSON.stringify(params);
	        	const name = `${method} (${paramsStr}`;
	        	console.error(`Error with asyncCall: ${name} ${params}`, e);
	        	throw e;
	        });
		};

		// resolves/rejects with response from web3.eth.<name>(args[0], args[1],...)
		this.doEthCall = function(name, args) {
			if (!args) args = [];
			if (!Array.isArray(args))
				throw new Error(`doAsyncEthCall(${name}) expects an array as args.`);
			return new Promise((resolve, reject)=>{
				const timeout = setTimeout(()=>{
					reject(new Error(`web3.eth.${name} call timed out.`));
				}, 5000);
				function callback(err, result){
					clearTimeout(timeout); 
					if (err){ reject(err); }
					if (result!==null){ resolve(result); }
					reject(new Error(`"_web3.eth.${name}" returned null.`));
				}
				_web3.eth[name].apply(_web3.eth, args.concat(callback));
			}).catch(e=>{
				console.error(`web.eth.${name} call failed`, args, e);
				throw e;
			});
		};

		// waits for a non-null response from web3.eth.<name>(args[0], args[1],...)
		this.pollEthCall = function(name, args) {
			if (!args) args = [];
			if (!Array.isArray(args))
				throw new Error(`doAsyncEthCall(${name}) expects an array as args.`);

			return new Promise((resolve, reject)=>{
				function callback(err, result){
					if (err){ reject(err); return; }
					if (result !== null){ resolve(result); return; }
					setTimeout(poll, 1000);
				}
				function poll() {
					_web3.eth[name].apply(_web3.eth, args.concat(callback));
				}
				poll();	
			});
		}

		//////// COMMON ETH CALLS ///////////////////////////////
		// todo: iterate over existing .eth to populate these all automatically.
		this.getTxReceipt = function(transactionHash, doPolling) {
			if (doPolling===undefined) doPolling = true;
			return doPolling
				? _self.pollEthCall("getTransactionReceipt", [transactionHash])
				: _self.doEthCall("getTransactionReceipt", [transactionHash]);
		};
		this.getTx = function(transactionHash, doPolling) {
			if (doPolling===undefined) doPolling = true;
			return doPolling
				? _self.pollEthCall("getTransaction", [transactionHash])
				: _self.doEthCall("getTransaction", [transactionHash]);
		};
		this.getBalance = function(addr) {
			if (addr.address) addr = addr.address;
			return _self.doEthCall("getBalance", [addr]);
		};
		this.getBlockNumber = function(){
			return _self.doEthCall("getBlockNumber");
		};
		this.getBlock = function(blockNum){
			return _self.doEthCall("getBlock", [blockNum]);
		};
		// finds the first block mined on or after a given date.
		this.getBlockNumberAtTimestamp = function(timestamp) {
			if (!Number.isInteger(timestamp))
				throw new Error('Invalid timestamp: ${timestamp}');
			return _self.getBlockNumber().then(cur => {
				return new Promise((res, ref)=>{
					var front = 0;
					var back = cur;
					iterate();

					function iterate(){
						const mid = Math.floor((front + back)/2);
						if (mid == front) { res(mid+1); return; }
						_self.getBlock(mid).then((block)=>{
							if (block.timestamp == timestamp){ res(mid); return; }
							if (block.timestamp > timestamp) back = mid;
							else front = mid;
							iterate();
						}) ;
					}
				});
			});
		}
		// gets storage value from a contract address at a given blocknum
		// Note: metamask doesnt support this at the moment... it caches
		//       results or something.
		this.getStorageAt = function(address, index, blockNum) {
			// convert blockNum to string.
			if (!Number.isInteger(blockNum) && typeof blockNum !== "string")
				throw new Error(`blockNum must be a string or an integer: ${blockNum}`);
			if (Number.isInteger(blockNum)) blockNum = web3.toHex(blockNum);

			return _self.sendAsync("eth_getStorageAt", [
				web3.toHex(address),
				web3.toHex(index),
				blockNum
			]);
		}
		// returns average blocktime (in seconds)
		//	 - avg of avg blocktime for last 100, 1000, and 5000 blocks.
		//   - returns promise for a BigNumber() of seconds
		this.getAverageBlockTime = function(){
			return _self.getBlock("latest").then((block)=>{
				const curBlockNum = block.number;
				const curBlockTime = block.timestamp;
				return Promise.all([
					_self.getBlock(Math.max(0, curBlockNum-50)),
					_self.getBlock(Math.max(0, curBlockNum-500)),
					_self.getBlock(Math.max(0, curBlockNum-5000)),
				]).then(arr=>{
					const num = ((curBlockTime - arr[0].timestamp)/50
						     +   (curBlockTime - arr[1].timestamp)/500
						     +   (curBlockTime - arr[2].timestamp)/5000)
							     / 3;
					return new BigNumber(num.toFixed(15));
				});
			});
		}

		// Returns the gasPrices, refreshing if older than 1 minute
		// To reduce HTTP calls, all calls are memoized.
		// EthGasStation we love you for allowing cross origin requests.
		// Sincerely, we thank you.
		var _lastGasPrices;
		var _gasPricePromise;
		this.getGasPrices = function(fresh){
			if (!fresh && _lastGasPrices && _lastGasPrices.timestamp+60000 >= (+new Date())){
				return Promise.resolve(_lastGasPrices.data);
			}
			if (_gasPricePromise) return _gasPricePromise;

			const url = "https://ethgasstation.info/json/predictTable.json";
			_gasPricePromise = AJAX(url).then(function(res){
				_gasPricePromise = null;
				const obj = JSON.parse(res);
				const totalTxs = obj[0].tx_atabove;
				const formatted = obj.map((o,i)=>{
					const nextTxAtAbove = (obj[i+1] ? obj[i+1].tx_atabove : o.tx_atabove);
					return {
						gasPrice: o.gasprice,
						atOrAbove: o.tx_atabove,
						numTxs: o.tx_atabove - nextTxAtAbove,
						percentile: (1 - nextTxAtAbove/totalTxs) * 100,
						waitBlocks: o.expectedWait,
						waitTimeS: o.expectedTime * 60,
					};
				})
				_lastGasPrices = {
					timestamp: (+new Date()),
					data: formatted
				};
				return formatted;
			},(e)=>{
				_gasPricePromise = null;
				e.message = "Could not retrieve gas prices.";
				console.error(e);
				throw e;
			});
			return _gasPricePromise;
		}


		this.toEth = function(val) {
			try { var bn = new BigNumber(val); }
			catch (e) { throw new Error(`${val} is not convertable to a BigNumber`); }
			return bn.div(1e18);
		}
		this.toEthStr = function(val, digits, unit) {
			if (digits===undefined) digits = 4;
			if (!unit) unit = "Ether";
			val = _self.toEth(val);
			if (val.equals(0)) {}
			else if (val.abs().lt(".00000000000001")) { val = val.mul(1e18); unit = `wei-${unit}`; }
			else if (val.abs().lt(".0001")) { digits = 6; }
			return val.toFixed(digits) + ` ${unit}`;
		}
		this.toTokenStr = function(val, digits) {
			return _self.toEthStr(val, digits, "Penny");
		}
		this.toWei = function(val) {
			try { var bn = new BigNumber(val); }
			catch (e) { throw new Error(`${val} is not convertable to a BigNumber`); }
			return bn.mul(1e18);
		}
		// returns a link to Etherscan
		this.$getLink = function(str, id, type){
			const network = ({
				1: "",
				3: "ropsten.",
				4: "rinkeby.",
				52: "kovan."
			})[_curState.networkId];
			
			if (network === undefined)
				return $("<span></span>").text(str);
			if (str == _self.NO_ADDRESS)
				return $("<span></span>").text(str);

			return $("<a></a>").attr("href",`http://${network}etherscan.io/${type}/${id}`)
					.text(str)
					.attr("target","_blank");
		}
	}
	window.EthUtil = EthUtil;
}());