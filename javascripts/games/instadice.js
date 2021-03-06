Loader.require("dice")
.then(function(dice){
	ethUtil.onStateChanged((state)=>{
		if (!state.isConnected) return;
		refreshAllRolls(state);
		refreshStats();
		refreshLiveRolls();
	});

	/******************************************************/
	/*** BET PLACING UI ***********************************/
	/******************************************************/
	const $loader = $(".better .loader");
	const $wagerText = $(".better .wager .input");
	const $wagerRange = $(".better .wager .range");
	const $numberText = $(".better .number .input");
	const $numberRange = $(".better .number .range");
	const $valid = $(".better .valid");
	const $invalid = $(".better .invalid");
	const $msg = $(".better .invalid .msg");
	const $payout = $(".better .payout");
	const $multiple = $(".better .multiple");
	const $odds = $(".better .odds");

	// link the ranges to texts, and vice versa
	$(".better .input").focus(function(){
		$(this).select();
	});
	$wagerText.on("input", function(){
		const n = Number($(this).val());
		if (Number.isNaN(n)) return;
		$wagerRange.val(n*100);
		refreshPayout();
	});
	$wagerRange.on("input", function(){
		function round(n, nearest){
			const rounded = Math.round(n*nearest)/nearest;
			return rounded == 0 ? n : rounded;
		}
		const n = Number($(this).val());
		const rounded = round(n/100, 100);
		$wagerText.val(rounded);
		$(this).val(Math.round(rounded*100));
		refreshPayout();
	});
	$numberText.on("input", function(){
		const n = Number($(this).val());
		if (Number.isNaN(n)) return;
		$numberRange.val(n);
		refreshPayout();
	});
	$numberRange.on("input", function(){
		const n = Number($(this).val());
		$numberText.val(n);
		refreshPayout();
	});

	const _feeBipsPromise = dice.feeBips().then(res=>{
		_feeBips = res;
		return _feeBips;
	});

	var _minBet;
	var _maxBet;
	var _minNumber;
	var _maxNumber;
	var _bankroll;
	var _feeBips;
	function refreshBetUiSettings() {
		Promise.all([
			dice.minBet(),
			dice.maxBet(),
			dice.minNumber(),
			dice.maxNumber(),
			dice.bankroll(),
			dice.feeBips()
		]).then(arr=>{
			$loader.hide();
			_minBet = arr[0];
			_maxBet = arr[1];
			_minNumber = arr[2];
			_maxNumber = arr[3];
			_bankroll = arr[4];
			_feeBips = arr[5];
			$wagerText
				.attr("min", _minBet.div(1e18).toNumber())
				.attr("max", _maxBet.div(1e18).toNumber());

			let minBetHundreds = _minBet.div(1e16);
			let maxBetHundreds = _maxBet.div(1e16);
			$wagerRange
				.attr("min", minBetHundreds.toNumber());
			minBetHundreds.lt(1)
				? $wagerRange.attr("max", maxBetHundreds.plus(minBetHundreds).toNumber())
				: $wagerRange.attr("max", maxBetHundreds.toNumber());
			$numberText
				.attr("min", _minNumber.toNumber())
				.attr("max", _maxNumber.toNumber());
			$numberRange
				.attr("min", _minNumber.toNumber())
				.attr("max", _maxNumber.toNumber());

			refreshPayout();
		});
		// refresh every 60 seconds in case min/max has changed
		setTimeout(refreshBetUiSettings, 60000);
	}
	refreshBetUiSettings();

	function refreshPayout() {
		if (_minBet == null) { return; }
		$valid.hide();
		$invalid.hide();

		var bet = $wagerText.val();
		var number = $numberText.val();
		try { bet = (new BigNumber(bet)).mul(1e18) }
		catch (e) { bet = null; }
		try { number = new BigNumber(number); }
		catch (e) { number = null; }

		if (bet == null) {
			$invalid.show();
			$msg.text("Wager must be a number");
			return;
		}

		const betStr = ethUtil.toEthStr(bet);
		const minBetStr = ethUtil.toEthStr(_minBet);
		const maxBetStr = ethUtil.toEthStr(_maxBet);
		if (bet.lt(_minBet)) {
			$invalid.show();
			$msg.text(`Wager of ${betStr} is below the minimum of ${minBetStr}`);
			return;
		}
		if (bet.gt(_maxBet)) {
			$invalid.show();
			$msg.text(`Wager of ${betStr} is above the maximum of ${maxBetStr}`);
			return;	
		}

		if (number == null) {
			$invalid.show();
			$msg.text("Roll Number must be a number.")
			return;
		}
		if (number.lt(_minNumber)) {
			$invalid.show();
			$msg.text(`Roll Number of ${number} is below the minimum of ${minNumber}`);
			return;
		}
		if (number.gt(_maxNumber)) {
			$invalid.show();
			$msg.text(`Roll Number of ${number} is above the maximum of ${maxNumber}`);
			return;	
		}
		
		const payout = computePayout(bet, number);
		if (payout.gt(_bankroll)) {
			$invalid.show();
			$msg.empty().append(
				`Currently the maximum payout allowed is ${ethUtil.toEthStr(_bankroll)}.
				<br><br>
				Try lowering your bet or increasing your odds.`
			);
			return;
		}
		const multiple = payout.div(bet).toFixed(2);
		$valid.show();
		$payout.text(ethUtil.toEthStr(payout));
		$multiple.text(`${multiple}x return`);
		$odds.text(`${number}% win odds`);
	}
	refreshPayout();

	function computeResult(blockHash, id) {
        const hash = web3.sha3(blockHash + ethUtil.toBytesStr(id, 4), {encoding: "hex"});
        const bn = new BigNumber(hash);
        return bn.mod(100).plus(1);
    }
    function computePayout(bet, number) {
    	const feePct = _feeBips.div(10000);
    	const ret = (new BigNumber(1)).minus(feePct);
		return bet.mul(100).div(number).mul(ret);
    }

    // roll tip
    function _initRollButton(){
    	const gps = util.getGasPriceSlider(5);
    	const $rollBtn = $("#RollButton");
    	const $rollTip = $("#RollTip").append(gps.$e);
    	(function attachTip(){
    		tippy($rollBtn[0], {
				// arrow: false,
				theme: "light",
				animation: "fade",
				placement: "top",
				html: $rollTip.show()[0],
				trigger: "mouseenter",
				onShow: function(){ gps.refresh(); },
				onHidden: function(){
					// fixes a firefox bug where the tip won't be displayed again.
					$rollBtn[0]._tippy.destroy();
					attachTip();
				}
			});
    	}());

		$rollBtn.click(function(){
			this._tippy.hide(0);
			
			var bet = $wagerText.val();
			var number = $numberText.val();
			try { bet = (new BigNumber(bet)).mul(1e18) }
			catch (e) { bet = null; }
			try { number = new BigNumber(number); }
			catch (e) { number = null; }

			if (bet == null || number == null) {
				alert("Invalid bet or number.");
				return;
			}

			$(this).blur();
			try {
				var rollPromise = dice.roll({_number: number}, {value: bet, gas: 147000, gasPrice: gps.getValue()});
				rollPromise.waitTimeMs = (gps.getWaitTimeS() || 45) * 1000;
			} catch(e) {
				console.error(e);
				ethStatus.open();
				return;
			}
			
			trackResult(
				rollPromise,
				bet,
				number
			);
			doScrolling("#BetterCtnr", 400);
	    })
    }
    _initRollButton();
			

	// When they place a bet, show it and add it to _$currentRolls
	var _$currentRolls = {};
	const _$currentRollsCtnr = $(".currentRolls .rolls");
	const _$emptyCurrentRolls = $(".currentRolls .empty");
	const _$clearCurrentRolls = $(".currentRolls .clear").click(function(){
		_$currentRolls = {};
		_$emptyCurrentRolls.show();
		_$clearCurrentRolls.hide();
		_$currentRollsCtnr.empty();
		ethUtil.getCurrentState().then(refreshAllRolls);
	});
	function trackResult(p, bet, number) {
		_$emptyCurrentRolls.hide();
		_$clearCurrentRolls.show();

		var roll = {
			state: "prepending",
			id: null,
			bet: bet,
			number: number,
			payout: computePayout(bet, number)
		};
		var $e = $getRoll(roll).prependTo(_$currentRollsCtnr);

		const loadingBar = util.getLoadingBar(p.waitTimeMs);
		p.getTxHash.then((txId)=>{
			roll.state = "pending";
			roll.txId = txId;
			const $new = $getRoll(roll);
			$e.replaceWith($new);
			$e = $new;
			$e.find(".loading").show().append(loadingBar.$e);
		});
		p.then((res)=>{
			const event = res.events.find(ev => ev.name=="RollWagered" || ev.name=="RollRefunded");
			if (!event){
				throw new Error(
					`The transaction receipt unexpectedly contained no event.
					<br>Please refresh the page.`
				);
			}
			// display the roll, and poll if it is syncing.
			(function updateRoll(){
				dice.curId().then(curId => {
					// its possible that the curId is not yet updated.
					// if so, the roll is "syncing", waiting for provider to update.
					var roll = getRollFromWageredOrRefunded(event, curId);

					// if roll is displayed, and not syncing, do nothing.
					var $displayed = _$currentRolls[roll.id];
					if ($displayed && $displayed.data("roll").state != "syncing") return;

					// display the new roll. add it to _$currentRolls
					// it will now be updated as new events come in.
					const $new = $getRoll(roll);
					($displayed || $e).replaceWith($new);
					_$currentRolls[roll.id] = $new;

					// if it's syncing, poll every second for an updated curId()
					if (roll.state == "syncing") setTimeout(updateRoll, 1000);
				});
			}());
		}).catch((e)=>{
			roll.state = "failed"
			roll.failReason = e.message.split("\n")[0];
			if (e.receipt) {
				roll.created = {
					blockHash: e.receipt.blockHash,
					blockNumber: e.receipt.blockNumber,
					txId: e.receipt.transactionHash,
					time: new BigNumber((+new Date())/1000)
				};
			}
			const $new = $getRoll(roll);
			$e.replaceWith($new);
		});
	}


	/******************************************************/
	/*** COLLATING ROLLS FROM EVENTS **********************/
	/******************************************************/
	function getRollFromWageredOrRefunded(event, curId){
		const roll = {}
		roll.id = event.name=="RollWagered"
			? event.args.id
			: null;
		roll.txId = event.transactionHash;
		roll.state = event.name=="RollRefunded"
			? "refunded"
			: roll.id.gt(curId)
				? "syncing"
				: curId.equals(roll.id) ? "waiting" : "unresolved"
		roll.bet = event.args.bet;
		roll.number = event.args.number;
		roll.payout = event.name=="RollWagered"
			? event.args.payout
			: computePayout(roll.bet, roll.number);
		roll.result = event.name=="RollWagered"
			? computeResult(event.blockHash, event.args.id)
			: null;
		roll.isWinner = event.name=="RollWagered"
			? !roll.result.gt(roll.number)
			: null;
		roll.refundReason = event.name=="RollWagered"
			? null
			: event.args.msg;
		roll.created = {
			blockNumber: event.blockNumber,
			blockHash: event.blockHash,
			txId: event.transactionHash,
			txIndex: event.transactionIndex,
			time: event.args.time
		};
		return roll;
	}

	// Collate the events into an object for each roll:
	// - state (prepending, pending, refunded, waiting, unresolved, resolved, paid, paymentfailed)
	// - id, bet, number, result, isWinner
	// - refundReason, failReason
	// - created (blockNumber, blockHash, txId, txIndex, time)
	// - resolved (blockNumber, txId, time)
	// - paid (blockNumber, txId, time)
	// - paymentfailure (blockNumber, txId, time)
	function refreshAllRolls(state) {
		if (!state.account) return;
		Promise.all([
			dice.curId(),
			dice.getEvents("RollWagered", {user: state.account}, state.latestBlock.number - 256),
    		dice.getEvents("RollRefunded", {user: state.account}, state.latestBlock.number - 256),
    		dice.getEvents("RollResolved", {user: state.account}, state.latestBlock.number - 256),
    		dice.getEvents("PayoutSuccess", {user: state.account}, state.latestBlock.number - 256),
    		dice.getEvents("PayoutFailure", {user: state.account}, state.latestBlock.number - 256),
    		_feeBipsPromise
		]).then((arr)=>{
			const curId = arr[0];
			const rollsWagered = arr[1];
			const rollsRefunded = arr[2];
			const rollsResolved = arr[3];
			const rollsPaid = arr[4];
			const rollsUnpayable = arr[5];
			const rolls = {};

			rollsWagered.concat(rollsRefunded).forEach((event)=>{
				const roll = getRollFromWageredOrRefunded(event, curId);
				rolls[roll.id || event.transactionHash] = roll;
			});
			rollsResolved.forEach((event)=>{
				const roll = rolls[event.args.id];
				if (!roll) return;
				if (!roll.result.equals(event.args.result))
					console.error("Contract got different result than us!", roll);
				roll.result = event.args.result;
				roll.state = "resolved";
				roll.resolved = {
					blockNumber: event.blockNumber,
					txId: event.transactionHash,
					time: event.args.time
				};
			});
			rollsPaid.forEach((event)=>{
				const roll = rolls[event.args.id];
				if (!roll) return;
				roll.state = "paid";
				roll.paid = {
					blockNumber: event.blockNumber,
					txId: event.transactionHash,
					time: event.args.time
				};
			});
			rollsUnpayable.forEach((event)=>{
				const roll = rolls[event.args.id];
				if (!roll) return;
				roll.state = "paymentfailed";
				roll.paymentfailure = {
					blockNumber: event.blockNumber,
					txId: event.transactionHash,
					time: event.args.time
				}
			});

			const allRolls = Object.values(rolls);
			allRolls.sort((a, b)=>{
				a = a.created;
				b = b.created;
				if (a.blockNumber < b.blockNumber) return -1;
				if (a.blockNumber > b.blockNumber) return 1;
				return a.txIndex < b.txIndex
					? -1
					: 1;
			}).reverse();
			refreshCurrentRolls(allRolls);
			refreshRecentRolls(allRolls);
		});
    }

    // for any roll that is in _$currentRolls, refresh it.
    // ignore rolls that are in _$lockedRolls.
    function refreshCurrentRolls(rolls) {
    	rolls.forEach((roll)=>{
    		if (!_$currentRolls[roll.id]) return;
    		if (_$lockedRolls[roll.id]) return;
    		const $new = $getRoll(roll);
			_$currentRolls[roll.id].replaceWith($new);
			_$currentRolls[roll.id] = $new;
    	})
    }

    const _$recentRollsCtnr = $(".recentRolls .rolls");
    const _$noRecentRolls = $(".recentRolls .empty");
    const _$lockedRolls = {};
    // given all rolls, ignore any that are _$currentRolls
    // and do not update any that are in _$lockedRolls
    // for the rest, rerender them entirely
    function refreshRecentRolls(rolls) {
    	const $rolls = rolls.map((roll)=>{
    		if (_$currentRolls[roll.id]) return;
    		return _$lockedRolls[roll.id]
    			? _$lockedRolls[roll.id].detach()
    			: $getRoll(roll);
    	}).filter(x=>!!x);
    	// append them all
    	_$recentRollsCtnr.empty();
    	$rolls.forEach($r=>$r.appendTo(_$recentRollsCtnr));
    	rolls.length == 0
    		? _$noRecentRolls.show()
    		: _$noRecentRolls.hide();
    }


	/******************************************************/
	/*** DISPLAY A ROLL ***********************************/
	/******************************************************/
	const avgBlockTime = ethUtil.getAverageBlockTime();
	const _msgs = [
    	"Don't give up so easily...",
    	"Don't give up so easily...",
    	"Don't give up so easily...",
    	"Don't give up so easily...",
    	"Don't give up so easily...",
    	"Better luck next time",
    	"Better luck next time",
    	"Better luck next time",
    	"Better luck next time",
    	"Better luck next time",
    	"You can shake it off",
    	"Stay strong",
    	"Believe in yourself",
    	"Follow your dreams",
    	"You'll win next time... maybe.",
    	"You're just a tiny bit unlucky",
    	"Let's pretend like this never happened.",
    	"By tomorrow, you'll forget all about this.",
    	"You miss 100% of the shots you don't take",
    	"Why not try again?",
    	"At least you still have your health.",
    	"Some things just weren't meant to be.",
    	"It's not the end of the world",
    	"Just do it!!!",
    	"Are you gonna do something about it?",
    	"It's not such a big deal.",
    ];
    function getLoseMsg(num) {
    	return _msgs[num % _msgs.length];
    }

    function $getRoll(roll) {
    	const $e = $(".roll.template")
    		.clone()
    		.removeClass("template")
    		.data("roll", roll)
    		.show();

    	const $status = $e.find(".status");
    	const $prepending = $e.find(".status .prepending").hide();
    	const $pending = $e.find(".status .pending").hide();
    	const $refund = $e.find(".status .refunded").hide();
    	const $failed = $e.find(".status .failed").hide();
    	const $result = $e.find(".result").hide();
    	const $mined = $e.find(".mined").hide();
    	const $viewLink = $e.find(".viewLink").hide();
    	$e.addClass(roll.state);
    	
    	const bet = roll.bet;
    	const number = roll.number;
    	const txId = roll.txId;
    	const multiple = roll.payout.div(bet).toFixed(2);
    	const payoutStr = ethUtil.toEthStr(roll.payout);
    	$e.find(".betValue").text(ethUtil.toEthStr(bet));
    	$e.find(".numberValue").text(`${number} or lower`);
    	$e.find(".payoutValue").text(`${payoutStr} (${multiple}x)`);
    	if (roll.state == "prepending") {
    		$prepending.show();
    		return $e;
    	}
    	if (roll.state == "pending") {
    		$pending.show();
    		$e.find(".pendingTxLink")
    			.append(util.$getTxLink("See it on Etherscan", roll.txId));
    		return $e;
    	}

    	if (roll.created) {
	    	const id = roll.id;
	    	const time = roll.created.time;
	    	const blockNum = roll.created.blockNumber;
	    	const blockHash = roll.created.blockHash;
			let options = {  
			    weekday: "short",
			    day: "numeric",
			    month: "short",
			    hour: "2-digit",
			    minute: "2-digit",
			    second: "2-digit"
			};

			const linkStr = id ? `Roll #${id}` : `No Roll`;
			const $txLink = util.$getTxLink(linkStr, txId);
	    	const dateStr = (new Date(roll.created.time.toNumber()*1000))
	    		.toLocaleString(window.navigator.language, options);
	    	$e.find(".mined").empty()
	    		.show()
	    		.append($txLink)
	    		.append(` ${dateStr} `);

	    	$viewLink.show().find("a")
	    		.attr("href", `/games/viewroll.html#${txId}`);
	    }

    	if (roll.state == "refunded") {
    		const msg = roll.refundReason;
    		$refund.show();
    		$refund.find(".reason").text(msg);
    		return $e;
    	}
    	if (roll.state == "failed") {
    		$failed.show();
    		$failed.find(".reason").text(roll.failReason);
    		return $e;
    	}

		$status.hide();
		$result.show();
		const $won = $result.find(".won").hide();
		const $lost = $result.find(".lost").hide();
		const $rollnumber = $result.find(".rollnumber");
		const $button = $result.find(".claim");
		const $claimStatus = $result.find(".claimStatus");
		
		const result = computeResult(roll.created.blockHash, roll.id);
		const didWin = !result.gt(number);
		$rollnumber.text(result);
		if (didWin) {
			$won.show();
			$button.click(()=>{
				var claimTxId;
				// lock this roll so it doesn't get updated.
				_$lockedRolls[roll.id] = $e;
				$e.addClass("claiming");
				const p = dice.payoutRoll([roll.id], {gas: 55000});
				// disable button, show stuff.
				$button.attr("disabled","disabled");
				$claimStatus.show();
				$claimStatus.text("Waiting for txId...");
				// update text
				p.getTxHash.then(function(txId){
					claimTxId = txId;
					$claimStatus.empty()
						.append(util.$getTxLink("Your claim is being mined.", txId))
				});
				// on success unlock, on failure, let them retry.
				p.then(function(){
					delete _$lockedRolls[roll.id];
					$claimStatus.empty()
						.append(util.$getTxLink("Transaction complete.", claimTxId))
						.append(" Please wait a moment.");
				}, function(e){
					$e.removeClass("claiming");
					$button.removeAttr("disabled");
					$claimStatus.empty()
						.append(`There was an error claiming: `)
						.append(util.$getTxLink(e.message.split("\n")[0], claimTxId))
						.append("<br>You should retry with more gas, or contact support");
				});
			})
		} else {
			$lost.show();
		}

		const $waiting = $result.find(".waiting").hide();
		const $syncing = $result.find(".syncing").hide();
		const $unresolved = $result.find(".unresolved").hide();
		const $paid = $result.find(".paid").hide();
		const $paymentFailure = $result.find(".paymentFailure").hide();
		const $lostMsg = $result.find(".lostMsg").hide();
		if (didWin){
			$e.addClass("won");
			if (roll.state == "waiting") {
				$waiting.show();
			} else if (roll.state == "syncing") {
				$syncing.show();
			} else if (roll.state == "unresolved") {
				$unresolved.show();
			} else if (roll.state == "paid") {
				$paid.empty()
					.append(`✓ Your winnings of ${payoutStr} `)
					.append(util.$getTxLink(`have been paid.`, roll.paid.txId))
					.show();
			} else if (roll.state == "paymentfailure") {
				$paymentFailure.show();
			}
		} else {
			$e.addClass("lost");
			const rand = (new BigNumber(roll.created.txId)).mod(1000).toNumber();
			$lostMsg.show().text(getLoseMsg(rand));
		}
		avgBlockTime.then((blocktime)=>{
			const curBlockNum = ethUtil.getCurrentBlockHeight();
			const blocksLeft = 255 - (curBlockNum - roll.created.blockNumber);
			const timeLeft = util.toTime(blocktime.mul(blocksLeft))
			$result.find(".blocksLeft").text(`${blocksLeft} blocks (~${timeLeft})`);
		});
    	return $e;
    }

    /******************************************************/
	/*** LIVE FEED ****************************************/
	/******************************************************/
	var _lastCheckedBlock = null;
	var _promiseInView = promiseInView($(".liveRolls")[0]);
	function refreshLiveRolls() {
		const MAX_ELEMENTS = 6;
		const toBlock = ethUtil.getCurrentBlockHeight().toNumber();
		const fromBlock = _lastCheckedBlock ? _lastCheckedBlock + 1 : (toBlock - 250);
		_lastCheckedBlock = toBlock;
		dice.getEvents("RollWagered", {}, fromBlock, toBlock)
			.then((events)=>_promiseInView.then(()=>events))
			.then((events)=>_feeBipsPromise.then(()=>events))
			.then((events)=>{
				if (events.length > MAX_ELEMENTS) events = events.slice(-MAX_ELEMENTS);
				events.forEach((e, i)=>{
					const txId = e.transactionHash;
					const rollId = e.args.id.toNumber();
					const dateStr = util.toDateStr(e.args.time);
					const betStr = ethUtil.toEthStr(e.args.bet);
					const number = e.args.number.toNumber();
					const $userLink = e.args.user == ethUtil.getCurrentAccount()
						? util.$getAddrLink("You!", e.args.user)
						: util.$getShortAddrLink(e.args.user);
					const payoutStr = ethUtil.toEthStr(e.args.payout);
					const result = computeResult(e.blockHash, rollId);
					const isWinner = !result.gt(number);

					const $rollLink = util.$getTxLink(`Roll #${rollId}`, txId);
					const $viewLink = $("<a target='_blank'>🔎</a>").attr("href", `/games/viewroll.html#${rollId}`)
					const $e = $(".mini-roll.template")
						.clone()
						.removeClass("template")
						.show()
						.prependTo($(".liveRolls .rolls"));
					$e.find(".head .right")
						.append($rollLink)
						.append(" ")
						.append($viewLink);
					$e.find(".date").text(dateStr);
					$e.find(".bettor").append($userLink);
					$e.find(".bet").text(betStr);
					$e.find(".number").text(number);
					$e.find(".payout").text(payoutStr);
					$e.find(".rollnumber").text(result)
					$e.find(".win-result").text(isWinner ? "and won" : "did not win");
					if (isWinner) $e.addClass("won");
					setTimeout(()=>$e.addClass("new"), (events.length-i)*200);
				});
				// trim excess elements (but not the template!)
				$(".mini-roll:not(.template)").toArray()
					.slice(MAX_ELEMENTS).forEach(e=>$(e).remove());
			});


	}



	/******************************************************/
	/*** LIVE STATS ***************************************/
	/******************************************************/
	// t: 0 to 1, returns 0 to 1
    function easeInOut(t) {
    	return t<.5 ? 2*t*t : -1+(4-2*t)*t;
    }
    function easeNumber(from, to, duration, cb) {
    	var cancel = false;
    	const diff = to - from;
    	const steps = 50;
    	for (var i=1; i<=steps; i++){
    		let n = i/steps;
			setTimeout(function(){
				if (cancel) return;
    			cb(from + easeInOut(n) * diff);
    		}, duration * n);
		}
		return ()=>{ cancel = true; }
    }

    const _prevEases = []
    function refreshStats() {
    	const $rolls = $("#Summary .rolls .value");
    	const $wagered = $("#Summary .wagered .value");
    	const $won = $("#Summary .won .value");
    	Promise.all([
    		dice.curId(),
    		dice.totalWagered(),
    		dice.totalWon()
    	]).then(arr=>{
    		const curRolls = Number($rolls.text());
    		const curWagered = Number($wagered.text());
    		const curWon = Number($won.text());
    		const newRolls = arr[0].toNumber();
    		const newWagered = arr[1].div(1e18).toNumber();
    		const newWon = arr[2].div(1e18).toNumber();
    		_prevEases.forEach(cancel => cancel());
    		_prevEases[0] = easeNumber(curRolls, newRolls, 3000, (n)=>{
    			$rolls.text(Math.round(n));
    		})
    		_prevEases[1] = easeNumber(curWagered, newWagered, 3000, (n)=>{
    			$wagered.text(n.toFixed(2));
    		});
    		_prevEases[2] = easeNumber(curWon, newWon, 3000, (n)=>{
    			$won.text(n.toFixed(2));
    		})
    	});
    }
    refreshStats();

});