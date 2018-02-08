Loader.require("tr", "mc", "pac")
.then(function(tr, mc, pac){
	const _paStartGps = util.getGasPriceSlider();
	_paStartGps.onChange(util.debounce(500, updatePaStart))
	_paStartGps.$e.find(".head").remove();
	_paStartGps.$refresh.show();
	_paStartGps.refresh();
	$(".paStart .gasPriceSlider").prepend(_paStartGps.$e);	

	const _paRefreshGps = util.getGasPriceSlider();
	_paRefreshGps.onChange(util.debounce(500, updatePaRefresh))
	_paRefreshGps.$e.find(".head").remove();
	_paRefreshGps.$refresh.show();
	_paRefreshGps.refresh();
	$(".paRefresh .gasPriceSlider").prepend(_paRefreshGps.$e);

	const _trDivGps = util.getGasPriceSlider();
	_trDivGps.onChange(util.debounce(500, updateTrDiv))
	_trDivGps.$e.find(".head").remove();
	_trDivGps.$refresh.show();
	_trDivGps.refresh();
	$(".trDiv .gasPriceSlider").prepend(_trDivGps.$e);

	updatePaStart();
	updatePaRefresh();
	updateTrDiv();

	var _isPaStarting = false;
	function updatePaStart() {
		if (_isPaStarting) return;
		const $e = $(".paStart");
		const $fields = $e.find(".fields");
		const $notice = $e.find(".no-reward");
		const $gasPrice = $e.find(".gasPrice");
		const $reward = $e.find(".reward .value").text("Loading...");
		const $cost = $e.find(".cost .value").text("Loading...");
		const $profit = $e.find(".profit .value").text("Loading...");
		const $risk = $e.find(".risk .value").text("Loading...");
		const $btn = $e.find(".execute button").unbind("click").attr("disabled","disabled");
		const failGasVal = new BigNumber($e.find(".failGasPrice").val());
		const gasPrice = _paStartGps.getValue();

		mc.canStartPennyAuction().then(res=>{
			var data = {
				canStart: res[0],
				index: res[1],
				reward: res[2],
				estGas: new BigNumber(0)
			}
			if (data.reward.gt(0)){
				data.estGas = new BigNumber(1100000);
			}
			return data;
		}).then(data=>{
			const canStart = data.canStart;
			const reward = data.reward;
			const estGas = new BigNumber(data.estGas);
			const index = data.index;

			if (canStart){
				$notice.hide();
				$fields.show();	
			} else {
				$notice.show();
				$fields.hide();
				return;
			}
			
			if (gasPrice) {
				const cost = estGas.mul(gasPrice);
				const profit = reward.minus(cost);
				const risk = failGasVal.mul(gasPrice);
				$reward.text(`${ethUtil.toEthStr(reward)}`);
				$cost.text(`${ethUtil.toEthStr(cost)} (${estGas} gas)`);
				$profit.text(`${ethUtil.toEthStr(profit)}`)
					.removeClass("good bad")
					.addClass(profit.gt(0) ? "good" : "bad");
				$risk.text(`${ethUtil.toEthStr(risk)} (${failGasVal} gas)`);
				$btn.removeAttr("disabled").click(()=>{
					_isPaStarting = true;
					_paStartGps.enable(false);
					$btn.attr("disabled", "disabled");
					const reset = ()=>{
						_isPaStarting = false;
						_paStartGps.enable(true);
						$btn.removeAttr("disabled");
						updatePaStart();
					}

					const p = mc.startPennyAuction([data.index], {
						gasPrice: gasPrice,
						gas: estGas.plus(100000)
					});
					p.then(reset, reset);

					const waitTimeMs = _paRefreshGps.getWaitTimeS() * 1000;
					const $txStatus = util.$getTxStatus(p, {
						waitTimeMs: waitTimeMs,
						onSuccess: res=>{
							const $msg = $("<div></div>").appendTo($e.find(".TxStatus .status"));
							const error = res.events.find(e => e.name == "Error");
							const started = res.events.find(e => e.name == "PennyAuctionStarted");
							const paid = res.events.find(e => e.name == "RewardPaid");
							const notPaid = res.events.find(e => e.name == "RewardNotPaid");
							if (error) {
								$msg.append(`Unable to start auction: ${error.args.msg}`);
								return;
							}
							if (started) {
								const $link = $("<a target='_blank'>Auction</a>")
									.attr("href",`/games/viewpennyauction.html#${started.args.addr}`);
								$msg.append($link).append(" started. ");
							}
							if (paid) {
								const $user = util.$getAddrLink(paid.args.recipient);
								const amtStr = ethUtil.toEthStr(paid.args.amount);
								$msg.append(`Rewarded `).append($user).append(` with ${amtStr}`);
							}
							if (notPaid) {
								const $user = util.$getAddrLink(notPaid.args.recipient);
								const amtStr = ethUtil.toEthStr(notPaid.args.amount);
								const note = notPaid.args.note;
								$msg.append(`Could not send `).append($user).append(` ${amtStr}: ${note}`);
							}
						}
					});
					$e.find(".tx").empty().append($txStatus);
				});
			} else {
				$reward.text("Invalid gasPrice");
				$cost.text("Invalid gasPrice");
				$profit.text("Invalid gasPrice");
				$risk.text("Invalid gasPrice");
			}
		});
	}

	var _isPaRefreshing = false;
	function updatePaRefresh() {
		if (_isPaRefreshing) return;
		const $e = $(".paRefresh");
		const $fields = $e.find(".fields");
		const $notice = $e.find(".no-reward");
		const $gasPrice = $e.find(".gasPrice");
		const $settings = $e.find(".settings .value").text("Loading...");
		const $available = $e.find(".available .value").text("Loading...");
		const $reward = $e.find(".reward .value").text("Loading...");
		const $cost = $e.find(".cost .value").text("Loading...");
		const $profit = $e.find(".profit .value").text("Loading...");
		const $risk = $e.find(".risk .value").text("Loading...");
		const $btn = $e.find(".execute button").unbind("click").attr("disabled","disabled");
		const gasPrice = _paRefreshGps.getValue(0);

		Promise.all([
			mc.paEndReward(),
			mc.paFeeCollectRewardDenom(),
			mc.canRefreshPennyAuctions(),
			mc.refreshPennyAuctions.estimateGas(),
			mc.refreshPennyAuctions.call(),
			mc.canRefreshPennyAuctions.estimateGas()
		]).then(arr=>{
			const endReward = arr[0];
			const feeCollectDenom = arr[1];
			const canRefresh = arr[2][0]
			const reward = arr[2][1];
			const estGas = new BigNumber(arr[3]);
			const gamesEnded = arr[4][0];
			const feesCollected = arr[4][1];
			const failGasVal = new BigNumber(arr[5]);

			if (canRefresh){
				$notice.hide();
				$fields.show();	
			} else {
				$notice.show();
				$fields.hide();
				return;
			}
			
			const perEndEth = ethUtil.toEthStr(endReward);
			const feePct = (new BigNumber(1)).div(feeCollectDenom).mul(100) + "%";
			const feesStr = ethUtil.toEthStr(feesCollected);
			$settings.text(`${perEndEth} per auction ended + ${feePct} of fees collected`);
			$available.text(`${gamesEnded} auctions to end, ${feesStr} in fees to collect.`);
			if (gasPrice) {
				const cost = estGas.mul(gasPrice);
				const profit = reward.minus(cost);
				const risk = failGasVal.mul(gasPrice);
				$reward.text(`${ethUtil.toEthStr(reward)}`);
				$cost.text(`${ethUtil.toEthStr(cost)} (${estGas} gas)`);
				$profit.text(`${ethUtil.toEthStr(profit)}`)
					.removeClass("good bad")
					.addClass(profit.gt(0) ? "good" : "bad");
				$risk.text(`${ethUtil.toEthStr(risk)} (${failGasVal} gas)`);
				$btn.removeAttr("disabled").click(()=>{
					_isPaRefreshing = true;
					_paRefreshGps.enable(false);
					$btn.attr("disabled", "disabled");
					const reset = ()=>{
						_isPaRefreshing = false;
						_paRefreshGps.enable(true);
						$btn.removeAttr("disabled");
						updatePaRefresh();
					}

					const p = mc.refreshPennyAuctions([], {
						gasPrice: gasPrice,
						gas: estGas.plus(100000)
					});
					p.then(reset, reset);

					const waitTimeMs = _paRefreshGps.getWaitTimeS() * 1000;
					const $txStatus = util.$getTxStatus(p, {
						waitTimeMs: waitTimeMs,
						onSuccess: res=>{
							const $msg = $("<div></div>").appendTo($e.find(".TxStatus .status"));
							const error = res.events.find(e => e.name == "Error");
							const refreshed = res.events.find(e => e.name == "PennyAuctionsRefreshed");
							const paid = res.events.find(e => e.name == "RewardPaid");
							const notPaid = res.events.find(e => e.name == "RewardNotPaid");
							if (refreshed) {
								const numEnded = refreshed.args.numEnded;
								const feesCollected = ethUtil.toEthStr(refreshed.args.feesCollected);
								$msg.append(`Ended ${numEnded} auctions and collected ${feesCollected}. `);
							}
							if (error) {
								$msg.append(`Error: ${error.args.msg} `);
								return;
							}
							if (paid) {
								const $user = util.$getAddrLink(paid.args.recipient);
								const amtStr = ethUtil.toEthStr(paid.args.amount);
								$msg.append(`Rewarded `).append($user).append(` with ${amtStr}`);
							}
							if (notPaid) {
								const $user = util.$getAddrLink(notPaid.args.recipient);
								const amtStr = ethUtil.toEthStr(notPaid.args.amount);
								const note = notPaid.args.note;
								$msg.append(`Could not send `).append($user).append(` ${amtStr}: ${note}`);
							}
						}
					});
					$e.find(".tx").empty().append($txStatus);
				});
			} else {
				$reward.text("Invalid gasPrice");
				$cost.text("Invalid gasPrice");
				$profit.text("Invalid gasPrice");
				$risk.text("Invalid gasPrice");
			}
		});
	}

	var _isTrUpdating = false;
	function updateTrDiv() {
		if (_isTrUpdating) return;
		const $e = $(".trDiv");
		const $fields = $e.find(".fields");
		const $notice = $e.find(".no-reward");
		const $gasPrice = $e.find(".gasPrice");
		const $amount = $e.find(".amount .value").text("Loading...");
		const $reward = $e.find(".reward .value").text("Loading...");
		const $cost = $e.find(".cost .value").text("Loading...");
		const $profit = $e.find(".profit .value").text("Loading...");
		const $risk = $e.find(".risk .value").text("Loading...");
		const $btn = $e.find(".execute button").unbind("click").attr("disabled","disabled");
		const failGasVal = new BigNumber($e.find(".failGasPrice").val());
		const gasPrice = _trDivGps.getValue(0);

		Promise.all([
			tr.getAmountToDistribute(),
			tr.distributeRewardDenom(),
			tr.distributeToToken.estimateGas(),
		]).then(arr=>{
			const amount = arr[0];
			const rewDenom = arr[1];
			const estGas = new BigNumber(arr[2]);

			if (amount.gt(0)) {
				$notice.hide();
				$fields.show();
			} else {
				$notice.show();
				$fields.hide();
				return;
			}

			$notice.hide();
			$fields.show();	
			$amount.text(ethUtil.toEthStr(amount));
			if (gasPrice) {
				const reward = amount.div(rewDenom);
				const pct = (new BigNumber(1)).div(rewDenom).mul(100) + "%";
				const cost = estGas.mul(gasPrice);
				const profit = reward.minus(cost);
				const risk = failGasVal.mul(gasPrice);
				$reward.text(`${ethUtil.toEthStr(reward)} (${pct} of profits)`);
				$cost.text(`${ethUtil.toEthStr(cost)} (${estGas} gas)`);
				$profit.text(`${ethUtil.toEthStr(profit)}`)
					.removeClass("good bad")
					.addClass(profit.gt(0) ? "good" : "bad");
				$risk.text(`${ethUtil.toEthStr(risk)} (${failGasVal} gas)`);
				$btn.removeAttr("disabled").click(()=>{
					_isTrUpdating = true;
					_trDivGps.enable(false);
					$btn.attr("disabled", "disabled");
					const reset = ()=>{
						_isTrUpdating = false;
						_trDivGps.enable(true);
						$btn.removeAttr("disabled");
						updateTrDiv();
					}

					const p = tr.distributeToToken([], {
						gasPrice: gasPrice,
						gas: estGas.plus(100000)
					});
					p.then(reset, reset);

					const waitTimeMs = _trDivGps.getWaitTimeS() * 1000;
					const $txStatus = util.$getTxStatus(p, {
						waitTimeMs: waitTimeMs,
						onSuccess: res=>{
							const $msg = $("<div></div>").appendTo($e.find(".TxStatus .status"));
							const error = res.events.find(e => e.name == "DistributeError");
							const success = res.events.find(e => e.name == "DistributeSuccess");
							const failure = res.events.find(e => e.name == "DistributeFailure");
							const paid = res.events.find(e => e.name == "RewardPaid");
							if (error) {
								$msg.append(`Error: ${error.args.msg} `);
								return;
							}
							if (success) {
								const ethStr = ethUtil.toEthStr(success.args.amount);
								$msg.append(`Distributed ${ethStr} to Token. `);
							}
							if (failure) {
								const ethStr = ethUtil.toEthStr(success.args.amount);
								$msg.append(`Couldn't distribute ${ethStr} to Token. `);	
							}
							if (paid) {
								const $user = util.$getAddrLink(paid.args.recipient);
								const amtStr = ethUtil.toEthStr(paid.args.amount);
								$msg.append(`Rewarded `).append($user).append(` with ${amtStr}`);
							}
						}
					});
					$e.find(".tx").empty().append($txStatus);
				});
			} else {
				$reward.text("Invalid gasPrice");
				$cost.text("Invalid gasPrice");
				$profit.text("Invalid gasPrice");
				$risk.text("Invalid gasPrice");
			}
			
		})
	}
});