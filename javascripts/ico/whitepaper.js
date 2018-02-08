Loader.onPageLoad.then(()=>{
	const ZERO = new BigNumber(0);
	const ONE = new BigNumber(1);
	// Initialize the Demo
	function Demo() {
		var _locked = false;

		const _$e = $("#demo");

		const _$token = _$e.find(".token");
		const _$th1 = _$e.find(".token-holder-one")
		const _$th2 = _$e.find(".token-holder-two")
		const _$th3 = _$e.find(".token-holder-three")
		const _$tokenLocker = _$e.find(".token-locker")
		const _tokenHolders = [_$th1, _$th2, _$th3, _$tokenLocker];

		const _$treasury = _$e.find(".treasury");
		const _$mainController = _$e.find(".main-controller");
		const _$pennyAuction = _$e.find(".penny-auction");
		const _$instaDice = _$e.find(".insta-dice");

		const _$playerOne = _$e.find(".player-one");
		const _$playerTwo = _$e.find(".player-two");
		const _$playerThree = _$e.find(".player-three");

		function _reset() {
			_$token.data("state", {divs: ZERO, supply: new BigNumber(200)});

			_$th1.data("state", {tokens: new BigNumber(80), tPct: 40, owed: ZERO, collected: ZERO});
			_$th2.data("state", {tokens: new BigNumber(60), tPct: 30, owed: ZERO, collected: ZERO});
			_$th3.data("state", {tokens: new BigNumber(40), tPct: 20, owed: ZERO, collected: ZERO});
			_$tokenLocker.data("state", {tokens: new BigNumber(20), tPct: 10, owed: ZERO, collected: ZERO});

			_$treasury.data("state",
				{balance: new BigNumber(104), bankroll: new BigNumber(90), dl: ONE, dlUsed: ZERO});
			_$mainController.data("state", {});
			_$pennyAuction.addClass("ended")
				.data("state", {state: "ended", prize: ONE, bidFees: ZERO, winner: $("")});
			_$instaDice.addClass("unfunded")
				.data("state", {balance: ZERO, funded: ZERO});

			_resetStatuses();
			_refresh();
			_refresh();
		}

		// attach tokenHolder events
		_tokenHolders.forEach(($e)=>{
			$e.find(".btn-collect-divs").click(()=>{ _collectDivs($e); });
			$e.find(".btn-burn").click(()=>{ _burn($e); });
		});

		// attach treasury events
		_$treasury.find(".btn-send-div").click(_sendDiv);
		_$treasury.find(".btn-ff").click(_ff);

		// attach mainController events
		_$mainController.find(".btn-restart-auction").click(_paRestart);
		_$mainController.find(".btn-pa-collect").click(_paCollect);
		_$mainController.find(".btn-id-fund").click(_idFund);
		_$mainController.find(".btn-id-collect").click(_idCollect);

		// attach PennyAuction events
		_$pennyAuction.find(".btn-end-auction").click(_endAuction);

		// attach player events
		[_$playerOne, _$playerTwo, _$playerThree].forEach(($e)=>{
			$e.find(".btn-bid").click(()=>{ _bid($e); });
			$e.find(".btn-roll").click(()=>{ _roll($e); })
		});

		// attach tips
		(function(){
			_$e.find(".title").toArray().forEach((title)=>{
				const $tip = $(title).parent().find(".demo-tip").show();
				if ($tip.length == 0) return;
				tippy(title, {
					position: "top",
					animation: "scale",
					trigger: "click",
					html: $tip[0],
					theme: "light"
				})
			})
		}())
		

		// move owed to collected
		function _collectDivs($th) {
			if (_locked) return;
			_resetStatuses();
			const thState = $th.data("state");
			const amt = thState.owed;
			if (!amt.gt(0)) {
				$th.find(".status").text(`Nothing to collect.`).addClass("error");
				_refresh();
				return;
			}

			_sendEth(_$token, $th).then(()=>{
				$th.find(".status").text(`Collected ${amt.toFixed(1)} Eth`);
				thState.owed = ZERO;
				thState.collected = thState.collected.plus(amt);
				_refresh();
			});
		}
		// set tokens to 0, decrease totalSupply, refresh other token holders
		function _burn($th) {
			if (_locked) return;
			_resetStatuses();

			const thState = $th.data("state");
			if (!thState.tokens.gt(0)){
				$th.find(".status").text("Nothing to burn.").addClass("error");
				_refresh();
				return;
			}

			const trState = _$treasury.data("state");
			const tokenState = _$token.data("state");
			const tlState = _$tokenLocker.data("state");
			
			// calculate how many tokens can be burned
			var thTokenBurn = thState.tokens;
			var thEthGain = thTokenBurn.div(2);
			var burnedAll = true;
			if (trState.balance.lt(thEthGain)) {
				thTokenBurn = trState.balance.mul(2);
				thEthGain = trState.balance;
				burnedAll = false;
			}

			// update state of tokenHolder, treasury, token, and tokenLocker
			_sendEth(_$treasury, $th).then(()=>{
				const tlBurn = thTokenBurn.div(9);
				const totalBurn = thTokenBurn.plus(tlBurn);
				thState.tokens = thState.tokens.minus(thTokenBurn);
				trState.bankroll = trState.bankroll.minus(thEthGain);
				trState.balance = trState.balance.minus(thEthGain)
				tokenState.supply = tokenState.supply.minus(totalBurn);
				tlState.tokens = tlState.tokens.minus(tlBurn);
				_$treasury.find(".status").text(`Sent ${thEthGain.toFixed(1)} Eth to user for burning tokens. Bankroll reduced.`);

				// update all token holder's pcts and status
				_tokenHolders.forEach(($e)=>{
					$e.data("state").tPct = $e.data("state").tokens.div(tokenState.supply).mul(100).round().toString();
					if ($e.data("state").tokens.gt(0)){
						$e.find(".status").text(`Ownership Increased`);
					}
				});
				$th.find(".status").text(`Got ${thEthGain} ETH.`);
				if (!burnedAll){
					_$treasury.find(".status").append(` No balance remaining!`).addClass("error");
					$th.find(".status").append(" Could not burn all tokens.").addClass("error");
				}
				_$tokenLocker.find(".status").text(`Burned tokens to stay at 10%`);
					
				_refresh();
			});
		}

		// increase token.divs, increase owed for each token holder
		function _sendDiv() {
			if (_locked) return;
			_resetStatuses();

			const trState = _$treasury.data("state");
			const divThreshold = trState.bankroll.plus(trState.dl.mul(14));
			const divAmt = trState.balance.minus(divThreshold)
			if (!divAmt.gt(0)) {
				_$treasury.find(".status").text(`Balance must be >${divThreshold} Eth to send dividends.`)
					.addClass("error");
				_refresh();
				return;
			}
			
			_sendEth(_$treasury, _$token).then(()=>{
				const tokenState = _$token.data("state");
				// update treasury balance, token dividends
				trState.balance = divThreshold;
				tokenState.divs = tokenState.divs.plus(divAmt);
				_$token.find(".status").text(`Received dividend of ${divAmt} Eth.`);
				_$treasury.find(".status").text(`Sent ${divAmt} Eth to Token.`);

				// update token holders' owed
				_tokenHolders.forEach(($th)=>{
					const thState = $th.data("state");
					const divShare = thState.tokens.div(tokenState.supply).mul(divAmt);
					if (divShare.gt(0)){
						thState.owed = thState.owed.plus(divShare);
						$th.find(".status").text(`Owed ${divShare.toFixed(1)} Eth more in dividends.`);
					}
				});
			
				_refresh();
			});
		}
		// set treasury dlUsed to 0
		function _ff() {
			if (_locked) return;
			_resetStatuses();

			const trState = _$treasury.data("state");
			trState.dlUsed = ZERO;
			_$treasury.find(".status").text(`Daily Limit is back to 0.`);
			_refresh();
		}

		// check treasury dailyLimit
		// update treasury numbers
		// start auction
		function _paRestart() {
			if (_locked) return;
			_resetStatuses();

			const paState = _$pennyAuction.data("state");
			if (paState.state == "started") {
				_$mainController.find(".status").text(`Auction has not ended.`).addClass("error");
				_refresh();
				return;
			}

			const trState = _$treasury.data("state");
			const prizeAmt = paState.prize;
			if (paState.bidFees.gt(0)) {
				_$mainController.find(".status").text(`Collect bidFees first.`).addClass("error");
				_refresh();
				return;
			}
			if (trState.dlUsed.plus(prizeAmt).gt(trState.dl)){
				_$treasury.find(".status").text(`Funding would exceed Daily Limit. (Skip to next day)`)
					.addClass("error");
				_$mainController.find(".status").text(`Treasury could not fund this.`)
					.addClass("error");
				_refresh();
				return;
			}
			if (trState.balance.lt(prizeAmt)) {
				_$treasury.find(".status").text(`Not enough balance to fund Penny Auction.`)
					.addClass("error");
				_$mainController.find(".status").text(`Treasury could not fund this.`)
					.addClass("error");
				_refresh();
				return;
			}

			_sendEth(_$pennyAuction, paState.winner)
				.then(() => _sendEth(_$treasury, _$mainController))
				.then(() => _sendEth(_$mainController, _$pennyAuction))
				.then(()=>{
					trState.balance = trState.balance.minus(prizeAmt);
					trState.dlUsed = trState.dlUsed.plus(prizeAmt);
					paState.state = "started";
					paState.bidFees = ZERO;
					paState.winner.find(".status").text(`Sent ${paState.prize} Eth prize.`);
					paState.winner = $("");
					_$pennyAuction.removeClass("ended");
					_$pennyAuction.find(".title").text("Penny Auction (started)");
					_$pennyAuction.find(".status").text("Started");
					_$mainController.find(".status").text(`Started Penny Auction.`)
					_$treasury.find(".status").text(`Funded MainController ${prizeAmt} Eth for a Penny Auction.`);
					_refresh();
				});
		}

		// Send ETH from PennyAuction to Treasury
		function _paCollect() {
			if (_locked) return;
			_resetStatuses();

			const paState = _$pennyAuction.data("state");
			const bidFees = paState.bidFees;
			if (!bidFees.gt(0)) {
				_$mainController.find(".status").text("Penny Auction has no bidFees to collect.")
					.addClass("error");
				_refresh();
				return;
			}

			return _sendEth(_$pennyAuction, _$treasury).then(()=>{
				const trState = _$treasury.data("state");
				trState.balance = trState.balance.plus(bidFees);
				paState.bidFees = paState.bidFees.minus(bidFees);

				const divThreshold = trState.bankroll.plus(trState.dl.mul(14));
				const profit = trState.balance.minus(divThreshold);
				if (profit.gt(0)){
					_$treasury.find(".status").text(`Received ${bidFees} Eth. Can now issue a dividend of ${profit} Eth.`);
				} else {
					_$treasury.find(".status").text(`Need ${profit.mul(-1)} more Eth to send dividend. Gamble more.`);
				}
				
				_$pennyAuction.find(".status").text(`Sent ${bidFees} Eth to Treasury.`);
				_$mainController.find(".status").text(`Bid Fees sent to Treasury.`);
				_refresh();
			});
		}

		// Send ETH from treasury to Instadice
		function _idFund() {
			if (_locked) return;
			_resetStatuses();
			const trState = _$treasury.data("state");
			const idState = _$instaDice.data("state");
			if (trState.balance.lt(1)) {
				_$treasury.find(".status").text(`Not enough balance to fund InstaDice`).addClass("error");
				_$mainController.find(".status").text(`Treasury could not fund this.`).addClass("error");
				_refresh();
				return;
			}
			if (trState.dlUsed.plus(1).gt(trState.dl)){
				_$treasury.find(".status").text(`Funding would exceed Daily Limit. (Skip to next day)`)
					.addClass("error");
				_$mainController.find(".status").text(`Treasury could not fund this.`).addClass("error");
				_refresh();
				return;	
			}
			 
			_sendEth(_$treasury, _$mainController)
				.then(() => _sendEth(_$mainController, _$instaDice))
				.then(()=>{
					trState.balance = trState.balance.minus(1);
					trState.dlUsed = trState.dlUsed.plus(1);
					idState.funded = idState.funded.plus(1);
					idState.balance = idState.balance.plus(1);
					_$treasury.find(".status").text("Funded InstaDice 1 Eth");
					_$mainController.find(".status").text(`Funded MainController 1 Eth for InstaDice.`);
					_$instaDice.find(".status").text("Got funded 1 Eth.");
					_$instaDice.removeClass("unfunded");
					_refresh();
				});
		}

		// send Eth from InstaDice to Treasury
		function _idCollect() {
			if (_locked) return;
			_resetStatuses();
			const idState = _$instaDice.data("state");
			const collectAmt = idState.balance.minus(idState.funded);
			if (!collectAmt.gt(0)) {
				_$mainController.find(".status").text(`InstaDice has no profit to send.`).addClass("error");
				_refresh();
				return;
			}

			_sendEth(_$instaDice, _$treasury).then(()=>{
				const trState = _$treasury.data("state");
				trState.balance = trState.balance.plus(collectAmt);
				idState.balance = idState.balance.minus(collectAmt);

				const divThreshold = trState.bankroll.plus(trState.dl.mul(14));
				const profit = trState.balance.minus(divThreshold);
				if (profit.gt(0)){
					_$treasury.find(".status").text(`Received ${collectAmt} Eth. Can now issue a dividend of ${profit} Eth.`);
				} else {
					_$treasury.find(".status").text(`Need ${profit.mul(-1)} Eth to send dividend. Gamble more.`);
				}
				_$mainController.find(".status").text(`Told InstaDice to send profits.`);
				_$instaDice.find(".status").text(`Sent ${collectAmt} to Treasury.`);
				_refresh();
			});
		}

		// if started, mark it as ended
		function _endAuction() {
			if (_locked) return;
			_resetStatuses();

			const paState = _$pennyAuction.data("state");
			if (paState.state == "started") {
				paState.state = "ended";
				_$pennyAuction.addClass("ended");
				_$pennyAuction.find(".title").text(`Penny Auction (ended)`);
				_$pennyAuction.find(".status").text(`Penny Auction has ended.`);
			} else {
				_$pennyAuction.find(".status").text(`Auction was never started.`).addClass("error");
			}
			_refresh();
		}

		// add bidFee to penny auction
		function _bid($player) {
			_resetStatuses();

			const paState = _$pennyAuction.data("state");
			if (paState.state == "ended") {
				$player.find(".status").text("Auction not started.").addClass("error");
				_refresh();
				return;
			}
			
			_sendEth($player, _$pennyAuction).then(()=>{
				paState.winner = $player;
				paState.bidFees = paState.bidFees.plus(new BigNumber(.1));
				_$pennyAuction.find(".status").text(`Received .1 Eth`);
				$player.find(".status").text(`Sent .1 Eth`);
				_refresh();	
			});
		}

		// roll, either add or subtract from InstaDice
		function _roll($player) {
			_resetStatuses();

			const idState = _$instaDice.data("state");
			if (idState.balance.lt(.1)) {
				_$instaDice.find(".status").text("Not enough balance to roll. Please fund.").addClass("error");
				$player.find(".status").text("Refunded wager.");
				_refresh();
				return;
			}

			_sendEth($player, _$instaDice).then(()=>{
				const doWin = Math.random() > .4;
				if (doWin){
					idState.balance = idState.balance.plus(.1);	
					_$instaDice.find(".status").text("Won .1 from a roll.");
					$player.find(".status").text("Lost .1 from a roll.");
				} else {
					idState.balance = idState.balance.minus(.1);
					_$instaDice.find(".status").text("Lost .1 from a roll.");
					$player.find(".status").text("Won .1 from a roll.");
				}
				_refresh();
			});
		}

		function _resetStatuses() {
			_$e.find(".status").text("").removeClass("try error");
		}

		function _sendEth($from, $to) {
			_locked = true;
			return new Promise((resolve, reject)=>{
				const duration = 500;
				if (!$from || !$to) return resolve();
				const startOffset = $from.offset();
				const stopOffset = $to.offset();
				if (!startOffset || !stopOffset) return resolve();

				const $img = $("<img>")
					.attr("src", "/images/ethereum.png")
					.attr("width", 35)
					.css({
						opacity: 0,
						position: "absolute",
						top: -100,
						left: -100,
						background: "rgba(215,255,255,.9)",
						border: "1px solid #AAA",
						borderRadius: "40px",
						boxShadow: "0px 0px 10px 0px rgba(0,0,255,.5)"
					})
					.appendTo(document.body);

				const startX = startOffset.left - $img.width()/2 + $from.width()/2;
				const startY = startOffset.top - $img.height()/2 + $from.height()/2;
				const stopX = stopOffset.left - $img.width()/2 + $to.width()/2;
				const stopY = stopOffset.top - $img.height()/2 + $to.height()/2;


				const start = +new Date();
				window.requestAnimationFrame(function step(){
					const pct = Math.min((+new Date() - start) / duration, 1);
					const x = startX + pct*(stopX - startX);
					const y = startY + pct*(stopY - startY);
					$img.css({
						opacity: pct < .5 ? pct*4 : (1-pct)*4,
						left: Math.round(x),
						top: Math.round(y)
					});
					if (pct < 1) window.requestAnimationFrame(step);
					else {
						$img.remove();
						resolve();
					}
				});
			}).catch((e)=>{}).then(()=>{
				_locked = false;
			});
		}

		// updates all states for all objects.
		// highlights buttons in green to suggest clicking them
		function _refresh() {
			[_$token, _$th1, _$th2, _$th3, _$tokenLocker,
			_$treasury, _$mainController, _$pennyAuction, _$instaDice,
			_$playerOne, _$playerTwo, _$playerThree].forEach(($e)=>{
				const state = $e.data("state");
				if (!state) return;
				Object.keys(state).forEach((name)=>{
					const $el = $e.find(`.${name}`)
					var str = state[name].toNumber
						? state[name].toFixed(1)
						: `${state[name]}`;
					if (str=="NaN") str = "0";

					const curVal = $el.text();
					$el.parent().removeClass("changed")
					if (str !== curVal) {
						$el.parent().addClass("changed");
						$el.text(str);
					}
				});
			});

			_$e.find("button").removeClass("try");
			if (_$pennyAuction.data("state").bidFees.gt(0)) {
				_$mainController.find(".btn-pa-collect").addClass("try");
			}
			if (_$pennyAuction.data("state").state == "started") {
				_$e.find(".btn-bid").addClass("try");
			} else {
				if (!_$pennyAuction.data("state").bidFees.gt(0)){
					_$mainController.find(".btn-restart-auction").addClass("try");
				}
			}
			if (_$instaDice.data("state").funded.gt(0)) {
				_$e.find(".btn-roll").addClass("try");
			} else {
				_$mainController.find(".btn-id-fund").addClass("try");
			}
			if (_$instaDice.data("state").balance.gt(_$instaDice.data("state").funded)) {
				_$mainController.find(".btn-id-collect").addClass("try");
			}
			const trState = _$treasury.data("state");
			if (trState.balance.gt(trState.bankroll.plus(trState.dl.mul(14)))) {
				_$treasury.find(".btn-send-div").addClass("try");
			}
			if (!trState.dl.gt(trState.dlUsed)) {
				_$treasury.find(".btn-ff").addClass("try");
			}

			_tokenHolders.forEach(($e)=>{
				if ($e.data("state").owed.gt(0)){
					$e.find(".btn-collect-divs").addClass("try");
				}
			})
		}

		this.reset = _reset;

		_reset();
	};
	window.demo = new Demo();


	function NavBar(selectors) {
		const _selectors = [".section > .head", ".subsection > .head", "h3", "h4"];
		const _items = _selectors.map(s=>$(s));
		const _$e = $(`<div class='NavBar'></div>`)
			.appendTo("#Breadcrumb")
			.css({
				display: "inline-block",
				position: "absolute",
				top: 6,
				left: 230,
				zIndex: 10
			});

		// return the first item that is above the fold.
		function getFirstAboveFold(elements) {
			const top = window.pageYOffset;
			const el = elements.reverse().find(el=>el.getBoundingClientRect().top < 130);
			return el ? $(el) : null;
		}

		$(window).on("scroll", function(){
			const $navItems = [];
			_items
				.map(cat => getFirstAboveFold(cat.toArray()))
				.filter($el => !!$el)
				.forEach(($el, i) => {
					if (i==0) { $navItems.push($el); return; }
					const prevTop = $navItems.slice(-1).pop()[0].getBoundingClientRect().top;
					const curTop = $el[0].getBoundingClientRect().top;
					if (curTop > prevTop) { $navItems.push($el); }
				});
			_$e.text($navItems.map($e=>$e.text()).join(" » "));

		});
	}
	window.navBar = new NavBar();
});