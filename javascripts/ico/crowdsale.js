Loader.require("comp")
.then(function(comp){
	const _$progress = $(".progress");
	const _$send = $(".send");
	const _$progressAmt = $(".progress .amt");
	const _$statSoftCap = $(".stat.softCap .value");
	const _$statHardCap = $(".stat.hardCap .value");
	const _$statRaised = $(".stat.raised .value");
	const _$statBonus = $(".stat.bonus .value");
	const _$cdSummary = $(".countdown .summary");
	const _$days = $(".days .value");
	const _$hours = $(".hours .value");
	const _$minutes = $(".minutes .value");
	const _$seconds = $(".seconds .value");
	const _$cont = $(".contribute");
	const _$contBtn = _$cont.find("button");
	const _$txtEther = _$cont.find(".txtEther");
	const _$finalizeBtn = $(".finalize button").click(finalize);
	const _gps = util.getGasPriceSlider(20);

	var _totalRaised;
	var _softCap;
	var _endCap;
	var _dateSaleStarted;
	var _dateSaleEnded;
	var _wasSaleEnded;

	ethUtil.onStateChanged((state)=>{
		if (!state.isConnected) return;
		refreshAll();
	});

	(function(){
		// enables/disabled contribute button
		function refreshContributeTip() {
			if ($(".requirement input:checked").length==3) {
				_$contBtn
					.removeClass("disabled")
					.removeAttr("title")
					.bind("click", contribute);
				_$contBtn[0]._tippy.disable();
			} else {
				_$contBtn
					.addClass("disabled")
					.attr("title", "You must meet the requirements to the left.")
					.unbind("click");
				_$contBtn[0]._tippy.enable();
			}
		}

		// init GPS, refresh every 60 seconds
		_gps.refresh();
		_gps.$e.appendTo(_$cont.find(".gasSlider"));
		setInterval(_gps.refresh, 6000);
		// on input change, refresh contribute msg
		_$txtEther.on("input", refreshContribute);

		// handle the contributeButton message
		$(".requirement input").on("change", refreshContributeTip);
		tippy(_$contBtn[0], {
			animation: "scale",
			trigger: "mouseenter",
			dynamicTitle: true
		});

		// refresh contribute button initially
		refreshContributeTip();
	}());

	// initialize sale parameters
	const _initialized = Promise.all([
		comp.dateSaleStarted(),
		comp.dateSaleEnded(),
		comp.softCap(),
		comp.hardCap()
	]).then(arr=>{
		_dateSaleStarted = arr[0].toNumber();
		_dateSaleEnded = arr[1].toNumber();
		_softCap = arr[2];
		_hardCap = arr[3];
	});

	// get values that may have changed, refresh stuff
	function refreshAll() {
		Promise.all([
			comp.totalRaised(),
			comp.wasSaleEnded(),
			_initialized
		]).then(arr=>{
			_totalRaised = arr[0];
			_wasSaleEnded = arr[1];

			// update all of the stats
			if (_totalRaised.gt(_hardCap.minus(1))){
				_$statHardCap.parent().addClass("reached");
			};
			if (_totalRaised.gt(_softCap.minus(1))){
				_$statSoftCap.parent().addClass("reached");
			}
			_$statSoftCap.text(`${_softCap.div(1e18)} Eth`);
			_$statHardCap.text(`${_hardCap.div(1e18)} Eth`);
			_$statRaised.text(`${_totalRaised.div(1e18).toFixed(2)} Eth`);

			// show/hide things
			refreshDisplay();
		});
	}

	// hides/shows proper things based on sale progress
	//  - sale not defined (Sale TBD)
	//  - before sale started (Sale starts ...)
	//  - during sale (Sale ends ...)
	//  - after sale (Sale Ended)
	var _timeLastUpdated = null;
	var _timeLeft = null;
	function refreshDisplay() {
		const blockTime = ethUtil.getCurrentBlockTime();
		// sale not defined
		if (!_dateSaleStarted){
			_timeLeft = null;
			_$progress.hide();
			_$send.hide();
			_$statBonus.parent().css("visibility","hidden");
			_$cdSummary.text(`Sale Date TBD. Check back soon.`);
			return;
		}

		// sale ended
		if (blockTime > _dateSaleEnded || _totalRaised && _totalRaised.equals(_hardCap)){
			_timeLeft = 0;
			_$progress.show();
			_$send.show();
			_$statBonus.parent().css("visibility","hidden");
			if ($(".TxStatus:visible").length==0) {
				$(".requirements").remove();
				$(".contribute").remove();
			}
			if (!_wasSaleEnded) {
				$(".finalize").show();
			}
			_$cdSummary.text(`Sale Ended!`);
			refreshProgress();
			return;
		}

		// sale not started yet.
		if (_dateSaleStarted >= blockTime) {
			_timeLeft = _dateSaleStarted - blockTime;
			_timeLastUpdated = +new Date();
			_$progress.hide();
			_$send.hide();
			_$cdSummary.text(`Sale starts ${util.toDateStr(_dateSaleStarted)}`);
			refreshProgress();
			refreshCountdown();
			return;
		}

		// sale not ended yet
		if (_dateSaleEnded >= blockTime) {
			_timeLeft = _dateSaleEnded - blockTime;
			_timeLastUpdated = +new Date();
			_$progress.show();
			_$send.show();
			_$cdSummary.text(`Sale ends ${util.toDateStr(_dateSaleEnded)}`);
			refreshProgress();
			refreshCountdown();
			refreshContribute();
			refreshBonus();
			return;
		}
	};

	function refreshBonus(){
		comp.getTokensFromEth([1e12]).then(tkns=>{
			const bonusPct = tkns.div(1e12).minus(1).mul(100);
			_$statBonus.text(`${bonusPct.round()}%`);
			if (bonusPct.lte(0)){
				_$statBonus.parent().css("visibility","hidden");
			}
		});
	}

	// shows the number of tokens received for a given amount of Ether
	function refreshContribute(){
		const $numTokens = _$cont.find(".numTokens");
		Promise.resolve().then(()=>{
			const $refund = _$cont.find(".refund");
			const val = (new BigNumber(_$txtEther.val())).mul(1e18);
			return comp.getTokensFromEth([val]).then((tokens)=>{
				$numTokens.text(tokens.div(1e18).toFixed(2));
				if (_totalRaised && _hardCap) {
					if (_totalRaised.plus(val).gt(_hardCap)) $refund.show();
					else $refund.hide();
				}
			});
		}).catch((e)=>{
			$numTokens.text("--");
		})
	}

	// animates progress bar to proper width
	function refreshProgress() {
		const progressPct = _totalRaised.div(_hardCap).mul(100).toFixed(2);
		_$progressAmt.css({
			width: `${progressPct}%`,
			opacity: 1
		});
	}

	// counts down from _timeLeft, which is reset each block.
	function refreshCountdown(){
		if (_timeLeft == null) {
			_$days.text("00");
			_$hours.text("00");
			_$minutes.text("00");
			_$seconds.text("00");
			return;
		};
		var timeLeft = _timeLeft + (_timeLastUpdated - (+ new Date()))/1000;
		timeLeft = Math.max(0, timeLeft);

		var days = Math.floor(timeLeft/(60*60*24));
		_$days.text(`${days<10?"0":""}${days}`);
		timeLeft -= days * 60*60*24;

		var hours = Math.floor(timeLeft/(60*60));
		_$hours.text(`${hours<10?"0":""}${hours}`);
		timeLeft -= hours * 60*60;

		var minutes = Math.floor(timeLeft/60);
		_$minutes.text(`${minutes<10?"0":""}${minutes}`);
		timeLeft -= minutes*60;

		var seconds = Math.floor(timeLeft);
		_$seconds.text(`${seconds<10?"0":""}${seconds}`);
	};
	(function pollCountdown(){
		setTimeout(pollCountdown, 1000);
		refreshCountdown();
	}());

	// sends transaction based on selection, shows results
	function contribute() {
		_$contBtn.blur();
		var gas = 175000;
		const value = (new BigNumber(_$txtEther.val())).mul(1e18);
		if (_totalRaised.gt(0)) gas = 100000;
		if (_totalRaised.gt(_softCap)) gas = 80000;
		const p = comp.sendTransaction({gas: gas, value: value});
		const $ctnr = _$cont.find(".txStatus").show();
		const $txStatus = util.$getTxStatus(p, {
			onClear: function(){ $ctnr.hide(); },
			onSuccess: function(res){
				const failure = res.events.find(e=>e.name=="BuyTokensFailure");
				const success = res.events.find(e=>e.name=="BuyTokensSuccess");
				const $msg = $("<div></div>");
				if (success) {
					const tokensStr = ethUtil.toTokenStr(success.args.numTokens);
					const refund = value.minus(success.args.value);
					const ethStr = ethUtil.toEthStr(success.args.value);
					$msg.append(`<div class='success'>You purchased ${tokensStr} for ${ethStr}.</div>`);
					if (refund.gt(0)) {
						const refundStr = ethUtil.toEthStr(refund);
						$msg.append(`<div>You were refunded ${refundStr}.</div>`);
					}
				}
				if (failure) {
					const eth = ethUtil.toEthStr(value);
					const reason = failure.args.reason;
					$msg
						.append(`<div class='failure'>Failure: ${reason}</div>`)
						.append(`<div>You were refunded ${eth}.</div>`);
				}
				// this should never happen, but just in case.
				if (!success && !failure) {
					$msg.append(`
						<div>
							Your transaction did not return any expected events!<br>
							Please double-check everything went ok.
						</div>
					`);
				}
				$txStatus.find(".status").append($msg);
			}
		});
		$ctnr.empty().append($txStatus);
	}

	function finalize() {
		const gas = 200000;
		const p = comp.endSale([], {gas: gas});
		const $ctnr = $(".finalize").find(".txStatus").show();
		const $txStatus = util.$getTxStatus(p);
		$ctnr.empty().append($txStatus);
	}
});