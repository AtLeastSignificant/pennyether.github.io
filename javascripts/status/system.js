var loadedHash = window.location.hash;

Loader.require("reg", "comp", "tr", "mc", "pac", "dice")
.then(function(reg, comp, tr, mc, pac, dice){
	var reg, comp, tr, mc, pac, dice;

	setTimeout(function goToLoadedHash(){
		if (!loadedHash) return;
		const $hash = $(loadedHash);
		if ($hash.length==0) return;
		doScrolling($hash.position().top-80, 500);
	}, 500);
	
	refreshAll();
	function refreshAll() {
		refreshRegistry();
		refreshWallet();
		refreshAdmin();
		refreshComp();
		refreshTr();
		refreshMc();
		refreshPac();
		refreshDice();
	}

	function refreshRegistry() {
		$("#RegistryAddr").empty().append(util.$getAddrLink(reg.address));
		util.bindToElement(util.$getLogs(reg, true), $("#RegistryLogs"), true);
	}
	function refreshWallet() {
		if (!reg) return;
		//address owner supervisor
		const p = comp.wallet().then((walletAddr)=>{
			const wallet = CustodialWallet.at(walletAddr);
			$("#WalletAddr").empty().append(util.$getAddrLink(walletAddr));
			util.bindToElement(wallet.custodian().then(util.$getAddrLink)
				, $("#WalletCustodian"), true);
			util.bindToElement(wallet.supervisor().then(util.$getAddrLink)
				, $("#WalletSupervisor"), true);
			util.bindToElement(wallet.owner().then(util.$getAddrLink)
				, $("#WalletOwner"), true);
			util.bindToElement(util.$getLogs(wallet, true), $("#WalletLogs"), true);
		})
	}
	function refreshAdmin() {
		if (!reg) return;
		const p = reg.addressOf(["ADMIN"]).then(util.$getAddrLink);
		util.bindToElement(p, $("#AdminAddr"), true);
	}

	function refreshComp() {
		if (!comp) return;
		$("#CompAddr").empty().append(util.$getAddrLink(comp.address));
		Promise.all([
			comp.token(),
			comp.locker()
		]).then(arr=>{
			const tokenAddr = arr[0];
			const lockerAddr = arr[1];
			$("#CompTokenAddr").empty().append(util.$getAddrLink(tokenAddr));
			$("#CompLockerAddr").empty().append(util.$getAddrLink(lockerAddr));
			const token = DividendToken.at(tokenAddr);
			util.bindToElement(comp.wallet().then(util.$getAddrLink), $("#CompOwner"), true);
			util.bindToElement(comp.treasury().then(util.$getAddrLink), $("#CompTreasury"), true);
			util.bindToElement(token.totalSupply().then(ethUtil.toTokenStr), $("#CompTokenTotalSupply"));
			util.bindToElement(token.balanceOf([lockerAddr]).then(ethUtil.toTokenStr), $("#CompLockerBalance"));
			util.bindToElement(util.$getLogs(comp, true), $("#CompLogs"), true);
			util.bindToElement(comp.dateSaleStarted().then(util.toDateStr), $("#CompDateSaleStarted"));
			util.bindToElement(comp.dateSaleEnded().then(util.toDateStr), $("#CompDateSaleEnded"));
			util.bindToElement(comp.totalRaised().then(ethUtil.toEthStr), $("#CompTotalRaised"));
		});
	}

	function refreshTr() {
		if (!tr) return;
		$("#TrAddr").empty().append(util.$getAddrLink(tr.address));
		util.bindToElement(tr.comptroller().then(util.$getAddrLink), $("#TrComp"), true);
		util.bindToElement(tr.token().then(util.$getAddrLink), $("#TrToken"), true);
		util.bindToElement(ethUtil.getBalance(tr).then(ethUtil.toEthStr), $("#TrBalance"));
		util.bindToElement(tr.bankroll().then(ethUtil.toEthStr), $("#TrBankroll"));
		util.bindToElement(tr.dailyFundLimit().then(ethUtil.toEthStr), $("#TrDailyLimit"));
		util.bindToElement(tr.getMinBalanceToDistribute().then(ethUtil.toEthStr), $("#TrDivThreshold"))
		util.bindToElement(util.$getLogs(tr), $("#TrLogs"), true);
	}

	function refreshMc() {
		if (!mc) return;
		const toPct = (val)=>val.pow(-1).mul(100);
		$("#McAddr").empty().append(util.$getAddrLink(mc.address));
		util.bindToElement(mc.version(), $("#McVersion"));
		util.bindToElement(mc.paStartReward().then(ethUtil.toEthStr), $("#McPaStartReward"));
		util.bindToElement(mc.paEndReward().then(ethUtil.toEthStr), $("#McPaEndReward"));
		util.bindToElement(mc.paFeeCollectRewardDenom().then(toPct), $("#McPaFeeCollectReward"));
		util.bindToElement(util.$getLogs(mc), $("#McLogs"), true);
	}

	function refreshPac() {
		if (!pac) return;

		function getNumActiveAuctions() {
			return pac.numDefinedAuctions().then((num)=>{
				const pArray = [];
				for (var i=0; i<num; i++){
					pArray.push(pac.getAuction([i]));
				}
				return Promise.all(pArray)
					.then((arr) => arr.filter(x=>x!=ethUtil.NO_ADDRESS).length);
			});
		}

		$("#PacAddr").empty().append(util.$getAddrLink(pac.address));
		util.bindToElement(pac.version(), $("#PacVersion"));
		util.bindToElement(getNumActiveAuctions(), $("#PacNumActiveAuctions"));
		util.bindToElement(pac.numEndedAuctions(), $("#PacNumEndedAuctions"));
		util.bindToElement(pac.totalPrizes().then(ethUtil.toEthStr), $("#PacTotalPrizes"));
		util.bindToElement(pac.totalFees().then(ethUtil.toEthStr), $("#PacTotalFees"));
		util.bindToElement(pac.totalBids(), $("#PacTotalBids"));
		util.bindToElement(util.$getLogs(pac), $("#PacLogs"), true);
	}

	function refreshDice() {
		if (!dice) return;
		$("#DiceAddr").empty().append(util.$getAddrLink(dice.address));
		util.bindToElement(dice.getAdmin(), $("#DiceAdmin"));
		util.bindToElement(dice.version(), $("#DiceVersion"));
		util.bindToElement(util.$getLogs(dice), $("#DiceLogs"), true);
	}
});