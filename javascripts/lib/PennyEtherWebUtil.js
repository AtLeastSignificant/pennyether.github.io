(function(){

	function PennyEtherWebUtil(niceWeb3) {
		var _self = this;

		this.bindToElement = function bindToElement(promise, element, doAppend) {
			element.empty().text("loading...");
			promise.then(function(res){
				doAppend
					? element.empty().append(res)
					: element.empty().text(res);
			},function(e){
				element.empty().text(`Error: ${e.message}`);
			});
		};

		this.bindToInput = 	function bindToInput(promise, element) {
			element.empty().text("loading...");
			promise.then(function(res){
				element.val(res);
			},function(e){
				element.val(`Error: ${e.message}`);
			});
		}

		this.$getLogs = function $getLogs(instance, allAtOnce) {
			const lv = new LogViewer({
				events: [{
					instance: instance,
					name: "all"
				}],
				order: "newest",
				allAtOnce: allAtOnce
			});
			return Promise.resolve(lv.$e);
		};

		this.$getLogViewer = function(opts) {
			const lv = new LogViewer(opts);
			return lv.$e;
		}

		this.getGasPriceSlider = function(defaultGWei, chooseInitialValue){
			return new GasPriceSlider(defaultGWei, chooseInitialValue);
		}

		this.$getTxStatus = function(p, opts) {
			const txStatus = new TxStatus(_self);
			txStatus.setTxPromise(p, opts);
			return txStatus.$e;
		}

		this.getTxStatus = function(opts) {
			const txStatus = new TxStatus(_self);
			txStatus.addOpts(opts);
			return txStatus;
		}

		this.$getShortAddrLink = function(addr) {
			const addrStr = addr.slice(0, 6) + "..." + addr.slice(-4);
			return _self.$getAddrLink(addrStr, addr);
		}
		this.$getAddrLink = function(name, addr){
			return niceWeb3.ethUtil.$getLink(name, addr || name, "address");
		}
		this.$getTxLink = function(name, tx){
			const shortName = name.length == 66
				? name.slice(0,10) + "..." + name.slice(-10)
				: name;
			return niceWeb3.ethUtil.$getLink(shortName, tx || name, "tx");
		}
		this.getLoadingBar = function(timeMs, speed) {
			return new LoadingBar(timeMs, speed);
		}

		this.toDateStr = function(timestampS){
			if (timestampS.toNumber) timestampS = timestampS.toNumber();
			var options = {
			    day: "numeric",
			    month: "short",
			    hour: "2-digit",
			    minute: "2-digit",
			    second: "2-digit"
			};
			if (timestampS == 0) return "n/a";
			return (new Date(timestampS*1000))
    			.toLocaleString(window.navigator.language, options);
		}

		this.getLocalTime = function(date){
			if (!date) date = new Date();
			return date.toLocaleString(window.navigator, {
				hour: "2-digit", minute: "2-digit", second: "2-digit"
			});
		}

		// returns something like "4h 3m 10s"
		this.toTime = function(timeS, numUnits, useColon) {
			try {
				numUnits = numUnits || 2;
				timeS = (new BigNumber(timeS)).round();
			} catch(e) {
				console.error("Val expected to be a number", timeS);
				return "<unknown>";
			}
			const days = timeS.div(60*60*24).floor();
			timeS = timeS.minus(days.mul(60*60*24));
			const hours = timeS.div(60*60).floor();
			timeS = timeS.minus(hours.mul(60*60));
			const minutes = timeS.div(60).floor();
			const seconds = timeS.minus(minutes.mul(60));
			if (days.gt(0)){
				if (numUnits == 1) return `${days}d`;
				if (numUnits == 2) return `${days}d ${hours}h`;
				return `${days}d ${hours}m ${minutes}m`;
			}
			if (hours.gt(0)) {
				if (numUnits == 1) return `${hours}h`;
				if (numUnits == 2) return `${hours}h ${minutes}m`;
				return `${hours}h ${minutes}m ${seconds}s`;
			}
			if (minutes.gt(0)) {
				if (numUnits == 1) return `${minutes}m`;
				return `${minutes}m ${seconds}s`;
			}
			return `${timeS}s`;
		}

		this.debounce = function(timeout, fn) {
			var i;
			const ret = function(){
				clearTimeout(i);
				i = setTimeout(fn, timeout);
			}
			ret();
			return ret;
		}
	}

	// loading bar that always looks like it'll take timeMs to complete.
	// speed tunes how fast the bar will load (but also the rate at which it slows)
	// exponential functions are such a mathematical gem.
	function LoadingBar(timeMs, speed) {
		const _$e = $(`
			<div class='LoadingBar' style='font-size: 0px; height: 5px;'>
				<div class='loaded' style='height: 100%; position: relative; left: 0px; width: 0%'>&nbsp;</div>
			</div>
		`);
		const _$loaded = _$e.find(".loaded");
		const _startTime = (+new Date());
		const _speed = 1 - (speed || .75);
		var _timeout;

		const timeStr = util.toTime(Math.round(timeMs / 1000));
		_$e.attr("title", `This is an estimate of time (~${timeStr}), based on the chosen gas price.`);
		if (tippy) {
			tippy(_$e[0], {
				trigger: "mouseenter",
				placement: "top",
				animation: "fade"
			});
		}

		function _update() {
			const t = (+new Date()) - _startTime;
			var pct = (1 - Math.pow(_speed, t/timeMs)) * 100
			_$loaded.css("width", pct.toFixed(2) + "%");
			_timeout = setTimeout(_update, 30);
		}

		this.finish = function(durationMs){
			return new Promise((res,rej)=>{
				clearTimeout(_timeout);
				const startTime = (+new Date());
				const startPct = Number(_$loaded[0].style.width.slice(0, -1));
				(function update(){
					const t = Math.min(1, (+new Date() - startTime)/durationMs);
					const newPct = startPct + (100 - startPct)*t;
					_$loaded.css("width", `${newPct.toFixed(2)}%`);
					if (t == 1) res();
					else setTimeout(update, 50);
				}());
			});
		}
		this.$e = _$e;

		if (_speed <= 0 || _speed >= 1)
			throw new Error("Speed must be between 0 and 1");
		_update();
	}

	/*
		opts: {
			events: [{
				instance:
				name:
				filter: {	// topics are ANDed
					topicName: value,
					topic2Name: value
				}
				formatters: {
					eventArg1: function(val){ ... }
					eventArg2: function(val){ ... }
				}
			},{ ... }],
			$head: content to put into head
			// which order to retrieve logs
			order: 'newest' || 'oldest',
			// if set to true, will scan all blocks in one request.
			// useful for things with not an absurd amount of events.
			allAtOnce: false
			// if order == 'oldest', must be provided
			startBlock: [current block],
			// if order == 'newest', tells LogViewer when to stop looking
			stopFn: (event)=>true/false of should stop
			// formatting fns
			dateFn: (event, prevEvent, nextEvent)=>{str}
			valueFn: (event)=>{str}
		}
	*/
	function LogViewer(opts) {
		const _BLOCKS_PER_SEARCH = 50000;
		const _MAX_SEARCH = _BLOCKS_PER_SEARCH*10;

		const _$e = $(`
			<div class='LogViewer'>
				<div class='head'></div>
				<div class='logs' style='overflow-y: auto;'>
					<div class='empty'>No Logs Found</div>
					<table cellspacing="0" cellpadding="0"></table>
				</div>
				<div class='status'></div>
			</div>
		`);
		if (!opts.order) opts.order = 'newest';
		if (!opts.events) throw new Error(`Must provide "events" option.`);
		if (opts.order=='oldest' && !opts.startBlock) throw new Error(`Must provide "startBlock"`);
		const _$logs = _$e.find(".logs").bind("scroll", _checkScroll)
		const _$head = _$e.find(".head");
		const _$table = _$e.find("table");
		const _$empty = _$e.find(".empty");
		const _$status = _$e.find(".status");

		const _order = opts.order;
		const _allAtOnce = opts.allAtOnce || false;
		const _startBlock = opts.startBlock || ethUtil.getCurrentBlockHeight().toNumber();
		const _endBlock = _order == 'newest'
			? Math.max(0, _startBlock - _MAX_SEARCH)
			: _startBlock + _MAX_SEARCH;
		const _stopFn = opts.stopFn || function(){};
		const _dateFn = opts.dateFn || _defaultDateFn;
		const _valueFn = opts.valueFn || _defaultValueFn;

		var _isDone = false;
		var _isLoading = false;
		var _prevBlock = _startBlock;	// the previously loaded block
		var _prevEvent = null;			// the previously loaded event
		var _$prevDateTd = null;		// the date cell of the _prevEvent
		var _leastFromBlock = Infinity;
		var _greatestToBlock = -1;
		
		var _requestCount = 0;

		function _checkScroll() {
			if (_isDone || _isLoading) return;

			const isNearBottom = _$logs[0].scrollHeight - _$logs.scrollTop() - _$logs.outerHeight() < 20;
  			if (!isNearBottom) return;
  			_loadMoreEvents().then(events=>{
  				if (events.length > 0) _$empty.hide();
  				events.forEach((event, i)=>{
  					const $row = $(`<tr></tr>`).appendTo(_$table);
  					const $dateTd = $(`<td class='date'></td>`).appendTo($row);
  					const $valueTd = $(`<td class='value'></td>`).appendTo($row);
  					const prevEvent = _order == 'newest' ? events[i+1] : _prevEvent;
  					const nextEvent = _order == 'newest' ? _prevEvent : events[i+1];
  					const $date = _dateFn(event, prevEvent, nextEvent);
  					const $value = _valueFn(event);
  					$dateTd.append($date);
  					$valueTd.append($value);
  					if (_$prevDateTd && i==0) {
  						const $lastDate = _dateFn(_prevEvent, prevEvent, nextEvent)
	  					_$prevDateTd.empty().append($lastDate);
	  				}
  					_isDone = _isDone || _stopFn(event);
					_prevEvent = event;
					_$prevDateTd = $dateTd;
  				});
  				_checkScroll();
  			});
		}

		function _loadMoreEvents() {
			// return if _isDone or _isLoading
			if (_isDone || _isLoading) return Promise.resolve([]);
			// compute from/to block
			var fromBlock, toBlock;
			if (_allAtOnce) {
	  			fromBlock = 0;
	  			toBlock = ethUtil.getCurrentBlockHeight().toNumber();
	  			_isDone = true;
	  		} else {
	  			if (_order == 'newest'){
					toBlock = _prevBlock;
					fromBlock = Math.max(_prevBlock - (_BLOCKS_PER_SEARCH-1), 0);
	  				_prevBlock = fromBlock - 1;
	  				if (fromBlock <= _endBlock) _isDone = true;
	  			} else {
	  				fromBlock = _prevBlock;
	  				toBlock = fromBlock + (_BLOCKS_PER_SEARCH-1);
	  				_prevBlock = toBlock + 1;
	  				if (toBlock >= _endBlock) _isDone = true;
	  			}
	  		}
	  		_greatestToBlock = Math.max(toBlock, _greatestToBlock);
	  		_leastFromBlock = Math.min(fromBlock, _leastFromBlock);

			// show that we're loading
			_isLoading = true;
			_$status.text(`Scanning blocks: ${fromBlock} - ${toBlock}...`);
  			// get promises for all events
  			const promises = opts.events.map((ev)=>{
  				if (!ev.instance) throw new Error(`opts.events.instance not defined.`);
  				if (!ev.name) throw new Error(`opts.events.name not defined.`);
  				return ev.name == "all"
  					? ev.instance.getAllEvents(fromBlock, toBlock)
  					: ev.instance.getEvents(ev.name, ev.filter, fromBlock, toBlock);
  			});
  			// concat all events, and sort. if none, try again in prev blocks
  			return Promise.all(promises).then((arr)=>{
  				function order(bool) {
  					return _order=='newest'
  						? bool ? -1 : 1
  						: bool ? 1 : -1;
  				}
  				_isLoading = false;
  				_$status.text(`Scanned blocks: ${_leastFromBlock} - ${_greatestToBlock}.`);

  				var allEvents = [];
  				arr.forEach((events)=>{ allEvents = allEvents.concat(events) });
  				allEvents.sort((a,b)=>{
					return a.blockNumber == b.blockNumber
						? order(a.logIndex > b.logIndex)
						: order(a.blockNumber > b.blockNumber)
				});
  				return allEvents.length > 0
  					? allEvents
  					: _loadMoreEvents();
  			});
		}

		function _defaultDateFn(e) {
			const dateStr = e.args && e.args.time
				? util.toDateStr(e.args.time)
				: `Block ${e.blockNumber}`;
			return util.$getTxLink(dateStr, e.transactionHash);
		}
		function _defaultValueFn(e) {
			var $argVals;
			if (!e.args) {
				$argVals = [$("<span></span>").text("Unable to decode data.")];
			} else {
				$argVals = Object.keys(e.args || [])
					.filter(name=>name!=="time")
					.map(name=>{
						var eventDef = opts.events.find(def => def.name===e.name);
						if (!eventDef) eventDef = opts.events.find(def => def.name=="all");
						const formatter = (eventDef.formatters || {})[name] || _defaultFormatter;
						return formatter(e.args[name], name);
					})
					.filter(str => !!str);
			}
			
			const $e = $("<div></div>").append(`<b>${e.name}</b> - `);
			$argVals.forEach(($v,i)=>{
				if (i!==0) $e.append(", ");
				$e.append($v)
			});
			return $e;
		}
		function _defaultFormatter(val, name) {
			const $e = $("<span></span>").append(`<b>${name}</b>: `);
			if (val.toNumber && val.gt(1000000000)){
				$e.append(ethUtil.toEthStr(val));	
			} else if (!val.toNumber && val.toString().length==42) {
				$e.append(util.$getShortAddrLink(val));
			} else if (!val.toNumber && val.toString().length==66) {
				// bytes32
				$e.append(niceWeb3.web3.toAscii(val));
			} else {
				$e.append(val.toString());
			}
			return $e;
		}

		this.$e = _$e;

		_$head.empty().append(opts.$head || "Log Viewer");
		_checkScroll();
	}

	// A slider to help the user choose a gas price.
	// When .refresh() is called:
	//   - Pulls data from EthGasStatus, sets default to lowest cost for <=60 second mining.
	// .getValue() returns the current value (Number):
	//		- defaultGWei (or 0)
	//		- autochosen value if its been refreshed
	//		- or value selected by user
	// .getWaitTimeS() returns (Number):
	//		- null if no value chosen
	//		- otherwise a regular Number
	function GasPriceSlider(defaultGWei, autoChoose){
		const AUTO_WAIT_TIME_S = 60;
		if (autoChoose===undefined) autoChoose = true;
		
		const _$e = $(`
			<div class="GasPriceSlider">
				<div class='head'>Choose Gas Price</div>
				<div class='loading'></div>
				<div class='content'>
					<input type="range" increment="1" class="slider">
					<div class='description'>
						<div class='gasPrice'></div>
						<div class='wait'></div>
						<div class='refresh'>↻</div>
					</div>
				</div>
			</div>
		`);
		const _$head = _$e.find(".head");
		const _$loading = _$e.find(".loading").text("Not initialized.").show();
		const _$content = _$e.find(".content").hide();
		const _$gasPrice = _$e.find(".gasPrice");
		const _$wait = _$e.find(".wait");
		const _$slider = _$e.find("input").on("input", _onSliderChanged);
		const _$refresh = _$e.find(".refresh").hide().click(()=>_refresh(true));
		var _gasData = {};
		var _value = defaultGWei || new BigNumber(0);
		var _waitTimeS = null;
		var _onChangeCb;

		// Retrieves gas data (up to 60s old)
		// Populates available gasPrices:
		//	- All gWei between 2 blocks and 2 hours waitTime, incremented by 1 GWei
		//	- discards gasPrices that are too slow or pointlessly expensive
		// If autoChoose is true:
		//	- selects least expensive gas price with waitTimeS <= AUTO_WAIT_TIME_S
		// If autoChoose is false
		//	- selects defaultGWei gas price, which will snap to closest available gasPrice
		function _refresh(fresh) {
			_$loading.show().text(`Loading gas data...`);
			_$content.hide();
			ethUtil.getGasPrices(fresh).then(data=>{
				var min = null;
				var max = null;
				var auto = Infinity;
				_gasData = {};
				data.forEach(d=>{
					_gasData[d.gasPrice] = d;
					// set min/max to first value that meets criteria
					if (!min && d.waitTimeS <= 2*60*60) min = d.gasPrice;
					if (!max && d.waitBlocks <= 2) max = d.gasPrice;
					// autochoose value to smallest value that meets criteria
					if (autoChoose && d.waitTimeS <= AUTO_WAIT_TIME_S) auto = Math.min(auto, d.gasPrice);
				});
				if (auto !== Infinity) _value = auto;
				if (min < 1) { max = max + min; }
				_$slider.attr("min", min).attr("max", max).val(_value);
				if (_$slider.val() > max) _$slider.val(max);
				if (_$slider.val() < min) _$slider.val(min);
				_$loading.hide();
				_$content.show();
				_onSliderChanged();
			}, (e)=>{
				_$loading.show().text(`Error: ${e.message}`);
				_$content.hide();
			});
		}

		// sets _value and _waitTimeS to the closest matching _gasData[] value.
		// updates display of _$wait and _$gasPrice
		function _onSliderChanged() {
			var val = _$slider.val();
			if (!_gasData[val]) {
				val = Object.keys(_gasData).reduce((prev, cur)=>{
					return Math.abs(cur - val) < Math.abs(prev - val) ? cur : prev;
				});
			}
			const data = _gasData[val];
			const blocks = data.waitBlocks;
			const timeStr = util.toTime(Math.round(data.waitTimeS));

			_value = val;
			_waitTimeS = data.waitTimeS;
			_$gasPrice.text(`${val} GWei`);
			_$wait.text(`~${blocks} Blocks (${timeStr})`);
			_$wait.removeClass("fast slow");
			if (data.waitTimeS <= 60) _$wait.addClass("fast");
			else if (data.waitTimeS > 60*15) _$wait.addClass("slow");
			if (_onChangeCb) _onChangeCb(val);
		}

		this.onChange = function(fn) {
			_onChangeCb = fn;
		};
		this.getValue = function(defaultValue){
			return (new BigNumber(_value)).mul(1e9);
		};
		this.getWaitTimeS = function(){
			return _waitTimeS;
		};
		this.enable = function(bool) {
			if (bool) {
				_$slider.removeAttr("disabled");
				_$e.removeClass("disabled");
			} else {
				_$slider.attr("disabled","disabled");
				_$e.addClass("disabled");
			}
		}
		this.refresh = _refresh;
		this.$e = _$e;
		this.$head = _$head;
		this.$refresh = _$refresh;
	}

	// A container that shows the progress of a txPromise
	// Includes many options, and can be used to show non-tx errors
	function TxStatus(_util) {
		const _$e = $(`
			<div class='TxStatus'>
				<div class='clear'>clear</div>
				<div class='status'></div>
			</div>
		`);
		const _opts = {};
		const _$clear = _$e.find(".clear").hide();
		const _$status = _$e.find(".status");

		_$clear.click(function(){
			_$e.remove();
			(_opts.onClear || function(){})();
		});

		function _setTxPromise(p, opts) {
			_addOpts(opts);
			const miningMsg = _opts.miningMsg || "Your transaction is being mined...";
			const successMsg = _opts.successMsg || "Your transaction was mined!";
			const waitTimeMs = _opts.waitTimeMs || 15000;
			const onSuccess = _opts.onSuccess || function(){};
			var txId;
			var loadingBar;

			_$status.text("Waiting for signature...");
			if (p.getTxHash){
				p.getTxHash.then(function(tId){
					txId = tId;
					loadingBar = _util.getLoadingBar(waitTimeMs);
					_$status.empty()
						.append(_util.$getTxLink(miningMsg, txId))
						.append(loadingBar.$e);
				});
			}

			p.then(function(res){
				if (loadingBar) {
					_$clear.show();
					loadingBar.finish(500).then(()=>{
						_$status.empty().append(_util.$getTxLink(successMsg, txId));
						onSuccess(res);
					});
				} else {
					onSuccess(res);
				}
			}).catch((e)=>{
				_$clear.show();
				if (txId) {
					loadingBar.finish(500).then(()=>{
						_$status.empty()
							.append(util.$getTxLink("Your tx failed.", txId))
							.append(`<br>${e.message}`);
					});
				} else {
					_$status.text(`${e.message.split("\n")[0]}`);	
				}
			});
		}

		function _addOpts(opts) {
			if (!opts) return;
			Object.assign(_opts, opts);
		}

		this.setTxPromise = (p, opts) => { _setTxPromise(p, opts); };
		this.setStatus = (str) => { _$status.text(str); };
		this.addOpts = (opts) => { _addOpts(opts); };
		this.fail = (str) => { _$clear.show(); _$status.text(str); };
		this.$e = _$e;
		this.$status = _$status;
	}
	
	window.PennyEtherWebUtil = PennyEtherWebUtil;
}())