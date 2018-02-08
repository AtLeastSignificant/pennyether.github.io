Loader.require("reg", "tr", "mc", "pac", "dice")
.then(function(reg, tr, mc, pac, dice){
	// puts a div in place of button
	// txFn(gasPrice) should return a tx promise
	function makeTxDiv($button, txFn) {
		const $e = $(`
			<div>
				<div class='gps'></div>
				<div class='btn'></div>
				<div class='status'></div>
			</div>
		`);
		const $status = $e.find(".status");

		// init gps
		const gps = util.getGasPriceSlider();
		gps.$head.remove();
		gps.$refresh.show();
		gps.refresh();
		$e.find(".gps").append(gps.$e)

		// replace button with div
		$button.replaceWith($e);
		
		// add button, set click event
		$e.find(".btn").append($button);
		$button.click(()=>{
			$button.blur();
			const p = txFn(gps.getValue());
			$status.empty().append(util.$getTxStatus(p, {
				waitTimeMs: gps.getWaitTimeS()*1000
			}));
		})
	}

	// init all tx divs
	makeTxDiv($("#TrChangeDailyFundLimit"), trChangeDailyFundLimit);
	makeTxDiv($("#TrFund"), trFund);
	makeTxDiv($("#McChangePaRewards"), mcChangePaRewards);
	makeTxDiv($("#DiceChangeSettings"), diceChangeSettings);
	makeTxDiv($("#btnDiceSendProfits"), diceSendProfits);
	makeTxDiv($("#btnDiceRemoveFunding"), diceRemoveFunding);
	makeTxDiv($("#btnDiceAddFunding"), diceAddFunding);
	makeTxDiv($("#btnDiceResolveMany"), diceResolveMany);
	makeTxDiv($("#btnDiceResolveLatest"), diceResolveLatest);

	$(".tr.refresh").click(updateTr);
	$(".mc.refresh").click(updateMc);
	$(".pac.refresh").click(updatePac);
	$(".dice.refresh").click(updateDice);

	updateAll();

	function updateAll(){
		updateTr();
		updateMc();
		updatePac();
		updateDice();
	}

	function updateTr() {
		if (!tr) return alert("tr not loaded.");
		$("#TrToday").text( ((+new Date())/(1000*60*60*24)).toFixed(2) );
		util.bindToElement(tr.getAdmin(), $("#TrAdmin"));
		util.bindToElement(tr.dayDailyFundLimitChanged(), $("#TrDailyFundLimitLastChanged"));
		util.bindToInput(tr.dailyFundLimit().then(ethUtil.toEth), $("#TrDailyFundLimit"));
	}

	function trChangeDailyFundLimit(gasPrice){
		if (!tr) return alert("tr not loaded.");
		const newLimit = ethUtil.toWei($("#TrDailyFundLimit").val());
		return tr.setDailyFundLimit({_newValue: newLimit}, {gasPrice: gasPrice});
	};

	function trFund(gasPrice){
		if (!tr) return alert("tr not loaded.");
		const amt = ethUtil.toWei($("#TrFundAmt").val());
		return tr.sendTransaction({gasPrice: gasPrice, value: amt});
	}

	function updateMc() {
		if (!mc) return alert("mc not loaded.");
		util.bindToElement(mc.getAdmin(), $("#McAdmin"));
		util.bindToInput(mc.paStartReward().then(ethUtil.toEth), $("#McPaStartReward"));
		util.bindToInput(mc.paEndReward().then(ethUtil.toEth), $("#McPaEndReward"));
		util.bindToInput(mc.paFeeCollectRewardDenom(), $("#McPaRewardDenom"));
	}
	function mcChangePaRewards(gasPrice){
		if (!mc) return alert("mc not loaded.");
		const paStartReward = ethUtil.toWei($("#McPaStartReward").val());
		const paEndReward = ethUtil.toWei($("#McPaEndReward").val());
		const paRewardDenom = $("#McPaRewardDenom").val();
		return mc.setPennyAuctionRewards({
			_paStartReward: paStartReward,
			_paEndReward: paEndReward,
			_paFeeCollectRewardDenom: paRewardDenom
		}, {gasPrice: gasPrice});
	}


	function updatePac() {
		if (!pac) return alert("pac not loaded.");
		util.bindToElement(pac.getAdmin(), $("#PacAdmin"));
		pac.numDefinedAuctions().then(function(num){
			const $ctnr = $("#PacDefinedAuctions").empty();
			const $template = $(".pacDefinedAuctionTemplate");
			for (var i=0; i<=num; i++){
				let index = i;
				let $defined = $template
					.clone()
					.removeClass("pacDefinedAuctionTemplate")
					.addClass("pacDefinedAuction")
					.appendTo($ctnr)
					.show();

				$defined.find(".index").text(index);
				pac.definedAuctions([index]).then((res)=>{
					$defined.find(".values").show();
					$defined.find(".auction").text(res[0]);
					$defined.find(".enabled").text(res[1] ? "ENABLED" : "DISABLED");
					$defined.find(".summary").val(res[2]);
					$defined.find(".initialPrize").val(ethUtil.toEth(res[3]));
					$defined.find(".bidPrice").val(ethUtil.toEth(res[4]));
					$defined.find(".bidIncr").val(ethUtil.toEth(res[5]));
					$defined.find(".bidAddBlocks").val(res[6]);
					$defined.find(".initialBlocks").val(res[7]);
					makeTxDiv($defined.find(".change"), (gasPrice)=>{
						return editDefinedAuction(index, gasPrice);
					});

					if (index == num){
						$defined.find(".change").text("Add");
						$defined.find(".enable").parent().remove();
						$defined.find(".disable").parent().remove();
					}else{
						$defined.find(".change").text("Save Changes");
						if (res[1]){
							$defined.find(".enable").parent().remove();
							makeTxDiv($defined.find(".disable"), (gasPrice)=>{
								if (!pac) return alert("Pac not loaded");
								return pac.disableDefinedAuction({_index: index}, {gasPrice: gasPrice});
							});
						} else {
							$defined.find(".disable").parent().remove();
							makeTxDiv($defined.find(".enable"), (gasPrice)=>{
								if (!pac) return alert("Pac not loaded");
								return pac.enableDefinedAuction({_index: index}, {gasPrice: gasPrice});
							});	
						}
					}
				});
			};
		});
	}
	function editDefinedAuction(index, gasPrice){
		if (!pac) return alert("Pac not loaded.");

		const $e = $("#PacDefinedAuctions").find(".pacDefinedAuction").eq(index);
		if ($e.find(".index").text()!=index)
			throw new Error("Got the wrong one!");
		var obj = {
			_index: index,
			_summary: $e.find(".summary").val(),
			_initialPrize: ethUtil.toWei($e.find(".initialPrize").val()),
			_bidPrice: ethUtil.toWei($e.find(".bidPrice").val()),
			_bidIncr: ethUtil.toWei($e.find(".bidIncr").val()),
			_bidAddBlocks: $e.find(".bidAddBlocks").val(),
			_initialBlocks: $e.find(".initialBlocks").val()
		};
		return pac.editDefinedAuction(obj, {gasPrice: gasPrice});
	}

	function updateDice() {
		if (!dice) return alert("dice not loaded.");
		util.bindToElement(ethUtil.getBalance(dice.address).then(ethUtil.toEthStr), $("#DiceBalance"));
		util.bindToElement(dice.curId(), $("#DiceNumRolls"));
		util.bindToElement(dice.getNumUnresolvedRolls(), $("#DiceNumUnresolved"));
		util.bindToElement(dice.getProfits().then(ethUtil.toEthStr), $("#DiceSendProfits"));
		util.bindToElement(dice.bankroll().then(ethUtil.toEthStr), $("#DiceBankroll"));
		util.bindToElement(dice.funding().then(ethUtil.toEthStr), $("#DiceFunding"));
		util.bindToElement(dice.getAdmin(), $("#DiceAdmin"));
		util.bindToInput(dice.feeBips(), $("#DiceFeeBips"));
		util.bindToInput(dice.minBet().then(ethUtil.toEth), $("#DiceMinBet"));
		util.bindToInput(dice.maxBet().then(ethUtil.toEth), $("#DiceMaxBet"));
		util.bindToInput(dice.minNumber(), $("#DiceMinNumber"));
		util.bindToInput(dice.maxNumber(), $("#DiceMaxNumber"));
		
		dice.curId().then((id)=>{
			return dice.rolls([id])
		}).then(roll=>{
			const result = roll[5];
			const isResolved = !result.equals(0);
			isResolved
				? $("#btnDiceResolveLatest").attr("disabled","disabled")
				: $("#btnDiceResolveLatest").removeAttr("disabled");
		});
	}
	function diceChangeSettings(gasPrice){
		if (!dice) return alert("dice not loaded.");
		const feeBips = $("#DiceFeeBips").val();
		const minBet = ethUtil.toWei($("#DiceMinBet").val());
		const maxBet = ethUtil.toWei($("#DiceMaxBet").val());
		const minNumber = $("#DiceMinNumber").val();
		const maxNumber = $("#DiceMaxNumber").val();
		return dice.changeSettings({
			_minBet: minBet,
			_maxBet: maxBet,
			_minNumber: minNumber,
			_maxNumber: maxNumber,
			_feeBips: feeBips
		}, {gasPrice: gasPrice});
	};
	function diceSendProfits(gasPrice){
		return dice.sendProfits([], {gasPrice: gasPrice});
	}
	function diceRemoveFunding(gasPrice){
		const num = ethUtil.toWei($("#DiceRemoveFunding").val());
		return dice.removeFunding([num], {gasPrice: gasPrice});
	}
	function diceAddFunding(gasPrice){
		const num = ethUtil.toWei($("#DiceAddFunding").val());
		return dice.addFunding([], {value: num, gasPrice: gasPrice});
	}
	function diceResolveMany(gasPrice){
		const num = new BigNumber($("#DiceResolveRolls").val());
		return dice.resolveUnresolvedRolls([num], {gasPrice: gasPrice})
	}
	function diceResolveLatest(gasPrice){
		return dice.payoutRoll([0], {gasPrice: gasPrice});
	}
});