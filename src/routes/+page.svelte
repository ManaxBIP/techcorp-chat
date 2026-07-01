<script lang="ts">
	import { chatStore } from '$lib';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Badge } from '$lib/components/ui/badge';
	import { onMount, onDestroy } from 'svelte';
	import {
		Send,
		Trash2,
		Bot,
		User,
		Server,
		Terminal,
		Loader2,
		ShieldCheck,
		MessageSquareCode,
		Sparkles,
		RefreshCw,
		Menu,
		X,
		TrendingUp,
		TrendingDown
	} from '@lucide/svelte';

	let inputMessage = $state('');
	let isSidebarOpen = $state(false);
	let chatEndRef = $state<HTMLDivElement | null>(null);

	// Ambient light parallax: the two signal glows drift slightly toward the pointer,
	// like glass catching light from a shifting source. Skipped under reduced motion.
	let glowX = $state(0);
	let glowY = $state(0);

	function handlePointerMove(event: PointerEvent) {
		glowX = event.clientX / window.innerWidth - 0.5;
		glowY = event.clientY / window.innerHeight - 0.5;
	}

	// Ambient market-pulse readout for the header ticker (decorative context, not live data)
	const marketPulse = [
		{ label: 'CAC 40', value: '7 512,4', delta: '+0,42%', up: true },
		{ label: 'EUR/USD', value: '1,0821', delta: '-0,08%', up: false },
		{ label: 'OAT 10 ans', value: '2,98%', delta: '+0,03', up: true },
		{ label: 'Bund 10 ans', value: '2,41%', delta: '+0,01', up: true },
		{ label: 'Or (XAU)', value: '2 384 $', delta: '+0,65%', up: true },
		{ label: 'VIX', value: '14,2', delta: '-1,10%', up: false }
	];

	// Bindings for configuration controls (initialized to current store values)
	let localApiUrl = $state('https://character-viewing-employer.ngrok-free.dev/api/chat');
	let localSimulationMode = $state(false);

	// Model settings
	let availableModels = $state<string[]>(['Phi-3.5-Financial', 'phi3', 'llama3']);
	let isFetchingModels = $state(false);

	// Server connection status (true = green, false = red)
	let isServerConnected = $state(true);
	let connectionInterval: any;

	// Sync settings when they change in the dashboard
	function updateSettings() {
		let cleanedUrl = localApiUrl.trim();
		if (cleanedUrl) {
			// Replace double slashes (except in http:// or https://)
			cleanedUrl = cleanedUrl.replace(/([^:]\/)\/+/g, '$1');
			// If it's a raw domain without /api/chat, let's append it
			cleanedUrl = cleanedUrl.replace(/\/$/, '');
			if (!cleanedUrl.endsWith('/api/chat') && cleanedUrl.indexOf('/api/') === -1) {
				cleanedUrl = cleanedUrl + '/api/chat';
			}
		}

		chatStore.setApiUrl(cleanedUrl);
		chatStore.setSimulationMode(localSimulationMode);

		if (localSimulationMode) {
			chatStore.setModel('Phi-3.5-Financial');
		}

		checkConnection();
		fetchModels();
	}

	// Svelte 5 reactive effect to track config inputs and sync automatically
	$effect(() => {
		updateSettings();
	});

	// Fetch models from local Ollama
	async function fetchModels() {
		if (localSimulationMode) {
			availableModels = ['Phi-3.5-Financial', 'phi3', 'llama3'];
			return;
		}

		isFetchingModels = true;
		try {
			if (!localApiUrl.startsWith('http://') && !localApiUrl.startsWith('https://')) {
				return;
			}

			let cleanedUrl = localApiUrl.trim().replace(/([^:]\/)\/+/g, '$1');
			const url = new URL(cleanedUrl);
			let fetchUrl = `${url.origin}/api/tags`;

			const isExternal = !localApiUrl.includes('localhost') && !localApiUrl.includes('127.0.5.1') && !localApiUrl.includes('127.0.0.1');
			if (isExternal) {
				fetchUrl = `/api/proxy?target=${encodeURIComponent(fetchUrl)}`;
			}

			const res = await fetch(fetchUrl);
			if (res.ok) {
				const data = await res.json();
				if (data.models && data.models.length > 0) {
					availableModels = data.models.map((m: any) => m.name);

					// Auto-select models if phi3 or similar is in there
					const currentModel = $chatStore.model;
					if (!availableModels.includes(currentModel)) {
						const matchesPhi3 = availableModels.find(
							(name: string) =>
								name.toLowerCase().includes('phi3') || name.toLowerCase().includes('phi')
						);
						if (matchesPhi3) {
							chatStore.setModel(matchesPhi3);
						} else {
							chatStore.setModel(availableModels[0]);
						}
					}
				}
			}
		} catch (err) {
			console.warn('Could not fetch models from Ollama api:', err);
		} finally {
			isFetchingModels = false;
		}
	}

	// Probe endpoint to check connection
	async function checkConnection() {
		if (localSimulationMode) {
			isServerConnected = true;
			return;
		}

		try {
			if (!localApiUrl.startsWith('http://') && !localApiUrl.startsWith('https://')) {
				isServerConnected = false;
				return;
			}

			let cleanedUrl = localApiUrl.trim().replace(/([^:]\/)\/+/g, '$1');
			const url = new URL(cleanedUrl);
			let checkUrl = url.origin;
			const isExternal = !localApiUrl.includes('localhost') && !localApiUrl.includes('127.0.5.1') && !localApiUrl.includes('127.0.0.1');

			if (isExternal) {
				checkUrl = `/api/proxy?target=${encodeURIComponent(checkUrl)}`;
				const res = await fetch(checkUrl);
				isServerConnected = res.ok;
			} else {
				// mode: 'no-cors' allows pinging localhost/remote without failing on CORS security checks
				await fetch(checkUrl, { method: 'GET', mode: 'no-cors' });
				isServerConnected = true;
			}
		} catch (err) {
			isServerConnected = false;
		}
	}

	onMount(() => {
		// Force dark mode active
		if (typeof document !== 'undefined') {
			document.documentElement.classList.add('dark');
		}

		// Poll reachability of the inference host every 5 seconds
		connectionInterval = setInterval(checkConnection, 5000);

		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			window.addEventListener('pointermove', handlePointerMove);
		}
	});

	onDestroy(() => {
		if (connectionInterval) {
			clearInterval(connectionInterval);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('pointermove', handlePointerMove);
		}
	});

	// Action: Send Message
	async function handleSend() {
		if (!inputMessage.trim() || $chatStore.isLoading) return;
		const msg = inputMessage.trim();
		inputMessage = '';
		await chatStore.sendMessage(msg);
	}

	// Action: Handle Keypress (Enter to send)
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	// Auto-scroll behavior when messages update
	$effect(() => {
		if ($chatStore.messages.length && chatEndRef) {
			setTimeout(() => {
				chatEndRef?.scrollIntoView({ behavior: 'smooth' });
			}, 50);
		}
	});
</script>

<svelte:head>
	<title>TechCorp Admin Dashboard - Phi-3.5-Financial</title>
	<meta
		name="description"
		content="Dashboard d'administration TechCorp et assistant de chat financier en mode sombre."
	/>
</svelte:head>

<div class="relative h-screen text-ink flex overflow-hidden font-sans antialiased">
	<!-- Ambient signal field: two drifting light sources the glass panels catch,
	     each drifting toward the pointer at a slightly different depth -->
	<div class="signal-field" aria-hidden="true">
		<div class="signal-glow-wrap" style="transform: translate({glowX * 46}px, {glowY * 30}px)">
			<div class="signal-glow signal-glow--emerald"></div>
		</div>
		<div class="signal-glow-wrap" style="transform: translate({glowX * -34}px, {glowY * -22}px)">
			<div class="signal-glow signal-glow--sapphire"></div>
		</div>
		<div class="signal-grain"></div>
	</div>

	<!-- 1. Left Sidebar -->
	<aside
		class="glass glass-strong fixed top-3 bottom-3 left-3 z-50 w-72 rounded-[28px] flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out lg:static lg:top-auto lg:bottom-auto lg:left-auto lg:my-4 lg:ml-4 lg:translate-x-0 lg:z-0 {isSidebarOpen
			? 'translate-x-0'
			: '-translate-x-[120%]'}"
	>
		<div class="p-6 space-y-6">
			<!-- Title Branding -->
			<div class="flex items-center justify-between border-b border-border pb-4 lg:border-b-0 lg:pb-0">
				<div class="flex items-center gap-3">
					<div
						class="h-9 w-9 rounded-xl glass glass-emerald flex items-center justify-center text-signal-emerald"
					>
						<Terminal size={18} />
					</div>
					<div>
						<h2 class="font-display text-sm font-semibold tracking-wider uppercase text-ink">TechCorp</h2>
						<p class="text-[10px] font-mono text-mist-dim">v2.4 — Chatbot Décisionnelle</p>
					</div>
				</div>
				<!-- Close button on mobile -->
				<Button
					variant="ghost"
					size="icon"
					onclick={() => (isSidebarOpen = false)}
					class="lg:hidden h-8 w-8 text-mist hover:text-ink hover:bg-white/8"
				>
					<X size={15} />
				</Button>
			</div>

			<!-- Status Panel (Connection & Active Model) -->
			<Card class="glass bg-transparent ring-0 shadow-none rounded-2xl">
				<CardContent class="p-4 space-y-4">
					<!-- Server Connection Status -->
					<div class="flex items-center justify-between">
						<span class="text-xs text-mist font-medium">Inférence</span>
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-ink/90">
								{isServerConnected ? 'Connecté' : 'Hors ligne'}
							</span>
							<span class="relative flex h-2.5 w-2.5">
								{#if isServerConnected}
									<span
										class="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-emerald opacity-75"
									></span>
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-emerald"></span>
								{:else}
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-rose"></span>
								{/if}
							</span>
						</div>
					</div>

					<!-- Active Model Badge / Dropdown Selection -->
					<div class="pt-3.5 border-t border-border flex flex-col gap-2">
						<span class="text-xs text-mist font-medium">Modèle de référence :</span>
						{#if localSimulationMode}
							<Badge
								class="glass glass-emerald text-ink/90 w-full justify-center py-1 text-[11px] font-mono select-none"
							>
								Modèle actuel : Phi-3.5-Financial
							</Badge>
						{:else}
							<div class="flex gap-1.5">
								<select
									value={$chatStore.model}
									onchange={(e) => chatStore.setModel(e.currentTarget.value)}
									class="glass flex-1 rounded-lg text-ink/90 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-signal-emerald/40 focus:border-signal-emerald/50 transition-all font-mono h-8"
								>
									{#each availableModels as modelName}
										<option value={modelName}>{modelName}</option>
									{/each}
								</select>
								<Button
									variant="ghost"
									size="icon"
									onclick={fetchModels}
									class="h-8 w-8 glass text-mist hover:text-ink hover:bg-white/8 animate-none shrink-0"
									title="Rafraîchir les modèles locaux"
								>
									<RefreshCw size={13} class={isFetchingModels ? 'animate-spin' : ''} />
								</Button>
							</div>
						{/if}
					</div>
				</CardContent>
			</Card>

			<!-- Configuration Form -->
			<div class="space-y-4">
				<!-- API URL Config -->
				<div class="space-y-2">
					<label
						for="api-url"
						class="text-xs font-semibold text-mist flex items-center gap-1.5"
					>
						<Server size={12} class="text-mist-dim" /> URL de l'API
					</label>
					<div class="glass rounded-xl px-0.5">
						<Input
							id="api-url"
							type="text"
							bind:value={localApiUrl}
							disabled={localSimulationMode}
							class="bg-transparent border-0 ring-0 shadow-none text-ink/90 text-xs focus-visible:ring-1 focus-visible:ring-signal-emerald/40 focus-visible:border-transparent"
							placeholder="https://character-viewing-employer.ngrok-free.dev/api/chat"
						/>
					</div>
				</div>

				<!-- Simulation Toggle Switch -->
				<div class="glass rounded-2xl p-3.5 flex items-center justify-between">
					<div class="space-y-0.5">
						<span class="text-xs font-semibold text-ink/90 flex items-center gap-1.5">
							<Sparkles size={12} class="text-signal-amber" /> Mode Simulation
						</span>
						<p class="text-[10px] text-mist-dim">Flux de réponse simulé</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input type="checkbox" bind:checked={localSimulationMode} class="sr-only peer" />
						<div
							class="relative w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-mist after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-signal-emerald peer-checked:after:bg-void"
						></div>
					</label>
				</div>
			</div>
		</div>

		<!-- Sidebar Footer -->
		<div class="p-6 border-t border-border space-y-4">
			<div class="flex items-center gap-2 text-xs text-mist">
				<ShieldCheck size={14} class="text-signal-emerald" />
				<span>Inférence Sécurisée SSL</span>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={() => chatStore.clearMessages()}
				class="w-full text-xs font-semibold glass glass-rose bg-transparent text-signal-rose hover:bg-signal-rose/10 transition-colors"
			>
				<Trash2 size={13} class="mr-1.5" />
				Vider le cache chat
			</Button>
		</div>
	</aside>

	<!-- Backdrop for mobile sidebar -->
	{#if isSidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onclick={() => (isSidebarOpen = false)}
			class="fixed inset-0 bg-void/70 backdrop-blur-sm z-40 lg:hidden"
		></div>
	{/if}

	<!-- 2. Main Area -->
	<main class="flex-1 flex flex-col overflow-hidden relative min-w-0">
		<!-- Header -->
		<header
			class="glass glass-strong mx-3 mt-3 lg:mx-4 lg:mt-4 h-16 rounded-2xl flex items-center justify-between px-4 lg:px-6 z-10 shrink-0"
		>
			<div class="flex items-center gap-2.5 min-w-0">
				<!-- Sidebar toggle for mobile -->
				<Button
					variant="ghost"
					size="icon"
					onclick={() => (isSidebarOpen = true)}
					class="lg:hidden h-8 w-8 glass text-mist hover:text-ink hover:bg-white/8 shrink-0"
					title="Ouvrir le panneau"
				>
					<Menu size={15} />
				</Button>

				<div class="h-2 w-2 rounded-full bg-signal-emerald animate-pulse shrink-0"></div>
				<div class="min-w-0">
					<h1
						class="font-display text-xs sm:text-sm font-semibold text-ink uppercase tracking-wider line-clamp-1"
					>
						Financial Intelligence Engine
					</h1>
					<p class="text-[9px] sm:text-[10px] text-mist-dim hidden sm:block">
						Inférence temps réel &amp; Analyses prédictives
					</p>
				</div>
			</div>

			<div class="flex items-center gap-4 text-[10px] sm:text-xs text-mist shrink-0">
				<span class="hidden md:inline"
					>Hôte : <code class="glass px-1.5 py-0.5 rounded-md text-[10px] font-mono text-mist"
						>{localSimulationMode ? 'Simulation locale' : new URL(localApiUrl).host}</code
					></span
				>
			</div>
		</header>

		<!-- Market Pulse Ticker: ambient trading-floor texture, decorative only -->
		<div
			class="glass mx-3 mt-2 lg:mx-4 h-8 rounded-xl flex items-center overflow-hidden z-10 shrink-0"
			aria-hidden="true"
		>
			<div class="ticker-track items-center gap-8 px-4 whitespace-nowrap font-mono text-[10px]">
				{#each [0, 1] as copy}
					{#each marketPulse as item}
						<span class="flex items-center gap-1.5 text-mist">
							<span class="text-mist-dim">{item.label}</span>
							<span class="text-ink/80">{item.value}</span>
							<span
								class="flex items-center gap-0.5 {item.up ? 'text-signal-emerald' : 'text-signal-rose'}"
							>
								{#if item.up}
									<TrendingUp size={10} />
								{:else}
									<TrendingDown size={10} />
								{/if}
								{item.delta}
							</span>
						</span>
					{/each}
				{/each}
			</div>
		</div>

		<!-- Chat View Area (ScrollArea) -->
		<div class="flex-1 overflow-hidden relative">
			<ScrollArea class="h-full w-full">
				<div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
					{#if $chatStore.messages.length === 0}
						<!-- Empty Dashboard Info -->
						<div
							class="h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 px-4"
						>
							<div
								class="h-14 w-14 rounded-2xl glass glass-sapphire flex items-center justify-center text-signal-sapphire shadow-md"
							>
								<MessageSquareCode size={24} />
							</div>
							<div class="space-y-2">
								<h3 class="font-display text-sm font-semibold text-ink tracking-wide">
									Prêt pour l'inférence financière
								</h3>
								<p class="text-xs text-mist leading-relaxed">
									Interrogez l'assistant décisionnel sur des analyses financières, des études de
									risques ou tout autre sujet. Chaque échange reste local à cette session.
								</p>
							</div>
							<div class="flex flex-col sm:flex-row gap-2 w-full justify-center">
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										inputMessage =
											'Simule une analyse des risques géopolitiques sur les marchés européens.';
										handleSend();
									}}
									class="sheen text-[11px] glass bg-transparent hover:bg-white/6 text-ink/85 py-2.5 sm:py-2"
								>
									"Analyse risques européens"
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										inputMessage = 'En quoi consiste le modèle Phi-3.5-Financial ?';
										handleSend();
									}}
									class="sheen text-[11px] glass bg-transparent hover:bg-white/6 text-ink/85 py-2.5 sm:py-2"
								>
									"Explication Phi-3.5"
								</Button>
							</div>
						</div>
					{:else}
						<!-- Messages Stream (ChatGPT-style representation) -->
						<div class="space-y-6">
							{#each $chatStore.messages as message (message.id)}
								<div
									class="flex gap-3 sm:gap-4 {message.role === 'user'
										? 'justify-end'
										: 'justify-start'}"
								>
									<!-- Assistant Bot Icon -->
									{#if message.role === 'assistant'}
										<div
											class="h-7 w-7 sm:h-8 sm:w-8 rounded-lg glass glass-sapphire flex items-center justify-center text-signal-sapphire shrink-0 mt-0.5"
										>
											<Bot
												size={14}
												class={$chatStore.isLoading && !message.content ? 'animate-spin' : ''}
											/>
										</div>
									{/if}

									<div class="space-y-1 max-w-[88%] sm:max-w-[78%]">
										<!-- Message Bubble
                      - user: right (glass, emerald-tinted)
                      - assistant: left (transparent, floats on the signal field)
                    -->
										<div
											class="p-3 sm:p-4 text-xs leading-relaxed whitespace-pre-wrap transition-all
                      {message.role === 'user'
												? 'glass glass-emerald text-ink rounded-2xl rounded-tr-none'
												: 'bg-transparent text-ink border-0 rounded-none'}"
										>
											<!-- Streaming/Loading Indicators -->
											{#if message.role === 'assistant' && !message.content && $chatStore.isLoading}
												<div class="flex items-center gap-1.5 py-1">
													<span
														class="w-1.5 h-1.5 bg-mist rounded-full animate-bounce"
														style="animation-delay: 0ms"
													></span>
													<span
														class="w-1.5 h-1.5 bg-mist rounded-full animate-bounce"
														style="animation-delay: 150ms"
													></span>
													<span
														class="w-1.5 h-1.5 bg-mist rounded-full animate-bounce"
														style="animation-delay: 300ms"
													></span>
												</div>
											{:else}
												{message.content}
											{/if}
										</div>

										<!-- Metadata -->
										<div
											class="flex items-center gap-2 px-1 text-[10px] font-mono text-mist-dim"
											class:justify-end={message.role === 'user'}
										>
											<span>{message.role === 'user' ? 'Administrateur' : 'Assistant Phi'}</span>
											<span>•</span>
											<span
												>{message.timestamp.toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit',
													second: '2-digit'
												})}</span
											>
										</div>
									</div>

									<!-- User Icon -->
									{#if message.role === 'user'}
										<div
											class="h-7 w-7 sm:h-8 sm:w-8 rounded-lg glass glass-emerald text-signal-emerald flex items-center justify-center shrink-0 mt-0.5"
										>
											<User size={14} />
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<!-- Scroll Anchor -->
					<div bind:this={chatEndRef}></div>
				</div>
			</ScrollArea>
		</div>

		<!-- Fixed Bottom Bar -->
		<div class="p-3 lg:p-4 shrink-0">
			<div class="max-w-4xl mx-auto">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSend();
					}}
					class="glass glass-strong flex gap-2 items-center rounded-2xl p-1.5 focus-within:border-signal-emerald/40 transition-all"
				>
					<Input
						bind:value={inputMessage}
						onkeydown={handleKeyDown}
						placeholder="Saisissez votre commande..."
						disabled={$chatStore.isLoading}
						class="flex-1 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-ink text-xs py-2 sm:py-3 px-2 sm:px-3 shadow-none placeholder:text-mist-dim"
					/>
					<Button
						type="submit"
						disabled={!inputMessage.trim() || $chatStore.isLoading}
						class="sheen bg-signal-emerald hover:bg-signal-emerald/90 text-void font-bold px-3 py-2 sm:px-4 text-xs rounded-lg transition-all flex items-center gap-1.5"
					>
						{#if $chatStore.isLoading}
							<Loader2 size={13} class="animate-spin text-void" />
						{/if}
						<span class="hidden sm:inline">Envoyer</span>
						{#if !$chatStore.isLoading}
							<Send size={13} class="block sm:hidden" />
						{/if}
					</Button>
				</form>
				<p class="text-[9px] sm:text-[10px] text-mist-dim mt-2 text-center select-none">
					Inférence sécurisée de niveau entreprise • Données de transactions confidentielles
				</p>
			</div>
		</div>
	</main>
</div>
