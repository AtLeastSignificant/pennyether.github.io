(function(){
	function Nav() {
		const _$e = $(`
			<div id="Nav">
				<div id="Top">
					<div align=left class="left">
						<div class="logo">
							PennyEther
						</div>
					</div>
					<div align=right class="middle">
					</div>
					<div align=right class="right">
						<div id="EthStatusGoesHere"></div>
					</div>
				</div>
				<div id="Breadcrumb">
					<div class="subMenuItem">Page 1</div>
					<div class="subMenuItem">Page 2</div>
					<div class="subMenuItem">Page 3</div>
					<div class="subMenuItem">Page 4</div>
				</div>
			</div>
		`);
		const _$menu = _$e.find(".middle");
		const _$status = _$e.find(".right");
		const _$breadcrumb = _$e.find("#Breadcrumb");

		const _siteMap = [
			{
				name: "Win Ether!",
				url: "/games/pennyauctions.html",
				children: [{
					name: "Penny Auctions",
					url: "/games/pennyauctions.html"
				},{
					name: "InstaDice",
					url: "/games/instadice.html"
				},{
					name: "Tasks",
					url: "/games/tasks.html"
				}]
			},
			{
				name: "Status",
				url: "/status/system.html",
				children: [{
					name: "System Status",
					url: "/status/system.html"
				},{
					name: "Treasury Status",
					url: "/status/treasury.html"
				},{
					name: "Game Controllers",
					url: "/status/games.html"
				},{
					name: "Token Holder UI",
					url: "/status/tokens.html"
				},{
					name: "Admin UI",
					url: "/status/admin.html",
				}]
			},
			{
				name: "About",
				url: "/about/mission.html",
				children: [{
					name: "Our Mission",
					url: "/about/mission.html"
				},{
					name: "Overview",
					url: "/about/pennyether.html"
				},{
					name: "Contracts",
					url: "/about/contracts.html",
					linkInBreacrumb: true,
					children: [{
						name: "Test Results",
						url: "/test-results/index.html"
					}]
				},{
					name: "Contact",
					url: "/about/contact.html"
				}]
			},
			{
				name: "ICO",
				url: "/ico/whitepaper.html",
				children: [{
					name: "Whitepaper",
					url: "/ico/whitepaper.html"
				},{
					name: "CrowdSale",
					class: "crowdsale",
					url: "/ico/crowdsale.html"
				}]
			}
		];

		_init();

		function _init() {
			var breadcrumb = [];
			const curUrl = window.location.pathname.toLowerCase();
			_$menu.empty();
			_siteMap.forEach(obj=>{
				// add menu item, set as breadcrumb (if there is none)
				const $e = $(`<a class='menuItem'></a>`)
					.addClass("menuItem")
					.attr("href", obj.url)
					.text(obj.name)
					.appendTo(_$menu);
				if (obj.class) $e.addClass(obj.class);

				if (obj.url.toLowerCase() == curUrl) {
					$e.addClass("on");
					if (breadcrumb.length==0) breadcrumb = [obj];
				}
				const children = obj.children || [];
				if (!children.length) return;

				// there are children. add a submenu.
				// if we find a matching url, set to breadcrumb
				// unless we already have a 2-level breadcrumb.
				const $sub = $(`<div class='subMenu'></div>`);
				children.forEach(child=>{
					const $child = $(`<a class='subItem'></a>`)
						.attr("href", child.url)
						.text(child.name)
						.appendTo($sub);
					if (child.class) $child.addClass(child.class);

					if (child.url == curUrl) {
						$child.addClass("on");
						if (breadcrumb.length!=2){
							breadcrumb = [obj, child];
							$e.addClass("on");
						}
					}

					if (child.children) child.children.forEach(grandchild=>{
						if (grandchild.url == curUrl){
							breadcrumb = [obj, child, grandchild];
							$e.addClass("on");
							$child.addClass("on");
						}
					});
				});
				$sub.appendTo($e);
			});

			document.title = breadcrumb.map(x=>x.name).join(" > ");
			_$breadcrumb.empty();
			$breadcrumb = $("<div></div>").appendTo(_$breadcrumb);
			while (breadcrumb.length) {
				const item = breadcrumb.shift();
				const $item = $("<div></div>")
					.addClass("item")
					.appendTo($breadcrumb);
				if (item.linkInBreacrumb && breadcrumb.length) {
					$item.append($("<a></a>").attr("href", item.url).text(item.name))
				} else {
					$item.text(item.name);
				}
			}
		}

		this.$e = _$e;
		this.setEthStatusElement = function($e) {
			_$status.empty().append($e)
		}
	}
	window.Nav = Nav;
}())