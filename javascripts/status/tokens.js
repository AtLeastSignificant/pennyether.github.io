Loader.require("comp")
.then(function(comp){
	return comp.token();
}).then(tokenAddr=>{
	const token = DividendToken.at(tokenAddr);
	const collectGps = util.getGasPriceSlider();
	const transferGps = util.getGasPriceSlider();
	const burnGps = util.getGasPriceSlider();
	const $collectDivs = $(".field.collectDivs");
	const $transfer = $(".field.transfer");
	const $burn = $(".field.burn");

	ethUtil.onStateChanged((state)=>{
		if (!state.isConnected) return;
		refreshDividends();
		//refreshAccount();
	});

	// initialize dividend logs
	$(".divHistory").append(util.$getLogViewer({
		events: [{
			instance: token,
			name: "DividendReceived"
		}],
		order: "newest",
		$head: "Dividend History"
	}));

	// initialize account address
	$("#AccountAddr").val(ethUtil.getCurrentAccount());
	refreshAccount();
	// append sliders
	$collectDivs.find(".gasSlider").append(collectGps.$e);
	$transfer.find(".gasSlider").append(transferGps.$e);
	$burn.find(".gasSlider").append(burnGps.$e);
	// bind events
	$("#RefreshAcct").click(refreshAccount);
	$(".btnCollect").click(doCollect);
	$(".btnTransfer").click(doTransfer);
	$(".btnBurn").click(doBurn);


	function refreshDividends() {
		// update address and total dividends
		$(".field.address .value").empty().append(util.$getAddrLink(tokenAddr));
		util.bindToElement(token.totalDividends().then(ethUtil.toEthStr), $(".field.dividends .divs"));
	}

	function refreshAccount() {
		const addr = $("#AccountAddr").val();
		const $balance = $(".field.balance .value").empty();
		const $totalSupply = $(".field.totalSupply .value").empty();
		const $owedDivs = $(".field.owedDivs .owedDivs").empty();
		const $collectHistory = $(".collectHistory").empty();
		const $transferHistory = $(".transferHistory").empty();
		const $mintHistory = $(".mintHistory").empty();
		collectGps.refresh();
		burnGps.refresh();
		transferGps.refresh();

		if (!addr || addr.length!=42) {
			$(".field.acctAddr .value .error").show().text("Invalid address.");
			return;
		} else {
			if (ethUtil.getCurrentAccount() == addr) {
				$collectDivs.show();
				$transfer.show();
				$burn.show();
			} else {
				$collectDivs.hide();
				$transfer.hide();
				$burn.hide();
			}
			$(".field.acctAddr .value .error").hide();
		}

		//update balance and owedDividends
		util.bindToElement(token.balanceOf([addr]).then(ethUtil.toTokenStr), $balance);
		util.bindToElement(token.totalSupply().then(ethUtil.toTokenStr), $totalSupply);
		util.bindToElement(token.getOwedDividends([addr]).then(ethUtil.toEthStr), $owedDivs);

		//event CollectedDividends(address indexed account, uint amount);
		util.$getLogViewer({
			events: [{
				instance: token,
				name: "CollectedDividends",
				filter: { account: addr },
				formatters: { account: function(){} }
			}],
			order: "newest",
			$head: "Collection History"
		}).appendTo($collectHistory);

		//event Transfer(address indexed from, address indexed to, uint amount);
		util.$getLogViewer({
			events: [{
				instance: token,
				name: "Transfer",
				filter: { from: addr },
				formatters: {
					from: function(){},
					amount: (v)=>ethUtil.toTokenStr(v)
				}
			},{
				instance: token,
				name: "Transfer",
				filter: { to: addr },
				formatters: {
					to: function(){},
					amount: (v)=>ethUtil.toTokenStr(v),
				}
			}],
			order: "newest",
			$head: "Transfer History"
		}).appendTo($transferHistory);

		//event TokensMinted(address indexed account, uint amount, uint newTotalSupply);
		//event TokensBurned(address indexed account, uint amount, uint newTotalSupply);
		util.$getLogViewer({
			events: [{
				instance: token,
				name: "TokensMinted",
				filter: { account: addr },
				formatters: {
					account: function(){},
					amount: (v)=>ethUtil.toTokenStr(v),
					newTotalSupply: function(){}
				}
			},{
				instance: token,
				name: "TokensBurned",
				filter: { account: addr },
				formatters: {
					account: function(){},
					amount: (v)=>ethUtil.toTokenStr(v),
					newTotalSupply: function(){}
				}
			}],
			order: "newest",
			$head: "Mint/Burn History"
		}).appendTo($mintHistory);
	}

	function doCollect(){
		const addr = ethUtil.getCurrentAccount();
		const txStatus = util.getTxStatus({ onClear: ()=>$status.hide() });
		const $status = $collectDivs.find(".status").show().empty().append(txStatus.$e);

		if (!addr) {
			ethStatus.open();
			txStatus.fail("No account available.");
			return;
		}

		txStatus.setStatus("Checking for dividends...");
		token.getOwedDividends([addr]).then(owed=>{
			if (owed.lte(0)) {
				txStatus.fail("No dividends to collect.");
				return;
			}
			const p = token.collectOwedDividends([], {gasPrice: collectGps.getValue()});
			const $txStatus = txStatus.setTxPromise(p, {
				waitTimeMs: collectGps.getWaitTimeS()*1000,
				onSuccess: function(res){
					// event CollectedDividends(address indexed account, uint amount);
					const collected = res.events.find(e=>e.name=="CollectedDividends");
					const $msg = $("<div></div>");
					if (collected) {
						const $account = util.$getShortAddrLink(collected.args.account);
						const ethStr = ethUtil.toEthStr(collected.args.amount);
						$msg.addClass("success").text(`Sent ${ethStr} to `).append($account).append(".");
					} else {
						$msg.addClass("error").text(`No dividend collected.`);
					}
					txStatus.$status.append($msg);
				}
			});
		});
	}

	function doTransfer(){
		const addr = ethUtil.getCurrentAccount();
		const to = $transfer.find(".transferTo").val();
		var amt = $transfer.find(".transferAmt").val();
		const txStatus = util.getTxStatus({ onClear: ()=>$status.hide() });
		const $status = $transfer.find(".status").show().empty().append(txStatus.$e);
		
		if (!addr) {
			ethStatus.open();
			txStatus.fail("No account available.");
			return;
		}
		if (!to || to.length!=42){
			txStatus.fail("Invalid 'to' address. Should begin with 0x and be 42 characters long.");
			return;
		}
		try {
			amt = (new BigNumber(amt)).mul(1e18);
		}catch(e){
			txStatus.fail(`Invalid amount. Must be a number.`);
			return;
		}

		txStatus.setStatus("Checking balance...");
		token.balanceOf([addr]).then(balance=>{
			const balanceStr = ethUtil.toTokenStr(balance);
			if (amt.gt(balance)){
				const amtStr = ethUtil.toTokenStr(amt);
				txStatus.fail(`Balance is only ${balanceStr}, cannot send ${amtStr}.`);
				return;
			}

			const p = token.transfer([to, amt], {gasPrice: transferGps.getValue()});
			const $txStatus = txStatus.setTxPromise(p, {
				waitTimeMs: transferGps.getWaitTimeS()*1000,
				onSuccess: function(res){
					//event Transfer(address indexed from, address indexed to, uint amount);
					const transfered = res.events.find(e=>e.name=="Transfer");
					const $msg = $("<div></div>");
					if (transfered) {
						const $from = util.$getShortAddrLink(transfered.args.from);
						const $to = util.$getShortAddrLink(transfered.args.to);
						const amtStr = ethUtil.toTokenStr(transfered.args.amount);
						$msg.addClass("success")
							.text(`Transferred ${amtStr} from `).append($from)
							.append(" to ").append($to).append(".");
					} else {
						$msg.addClass("error").text(`No transfer occurred.`);
					}
					txStatus.$status.append($msg);
				}
			});
		});
	}

	function doBurn(){
		const addr = ethUtil.getCurrentAccount();
		var amt = $burn.find(".burnAmt").val();
		const txStatus = util.getTxStatus({ onClear: ()=>$status.hide() });
		const $status = $burn.find(".status").show().empty().append(txStatus.$e);
		
		if (!addr) {
			ethStatus.open();
			txStatus.fail("No account available.");
			return;
		}
		try {
			amt = (new BigNumber(amt)).mul(1e18);
		}catch(e){
			txStatus.fail(`Invalid amount. Must be a number.`);
			return;
		}

		const p = comp.burnTokens([amt], {gasPrice: burnGps.getValue()});
		const $txStatus = txStatus.setTxPromise(p, {
			waitTimeMs: burnGps.getWaitTimeS()*1000,
			onSuccess: function(res){
				// event UserRefunded(uint time, address indexed sender, uint numTokens, uint refund);
				const refunded = res.events.find(e=>e.name=="UserRefunded");
				const $msg = $("<div></div>");
				if (refunded) {
					const tokensStr = ethUtil.toTokenStr(refunded.args.numTokens);
					const ethStr = ethUtil.toEthStr(refunded.args.refund);
					$msg.addClass("success").text(`Burned ${tokensStr} for ${ethStr}.`);
				} else {
					$msg.addClass("error").text(`No burning occurred.`);
				}
				txStatus.$status.append($msg);
			}
		});
	}
});