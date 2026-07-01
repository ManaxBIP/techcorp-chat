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
		X
	} from '@lucide/svelte';

	let inputMessage = $state('');
	let isSidebarOpen = $state(false);
	let chatEndRef = $state<HTMLDivElement | null>(null);

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
	});

	onDestroy(() => {
		if (connectionInterval) {
			clearInterval(connectionInterval);
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

<div class="h-screen bg-zinc-950 text-zinc-50 flex overflow-hidden font-sans antialiased">
	<!-- 1. Left Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-0 {isSidebarOpen
			? 'translate-x-0'
			: '-translate-x-full'}"
	>
		<div class="p-6 space-y-6">
			<!-- Title Branding -->
			<div
				class="flex items-center justify-between border-b border-zinc-800/60 pb-4 lg:border-b-0 lg:pb-0"
			>
				<div class="flex items-center gap-3">
					<div
						class="h-9 w-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"
					>
						<Terminal size={18} />
					</div>
					<div>
						<h2 class="text-sm font-semibold tracking-wider uppercase text-zinc-400">TechCorp</h2>
						<p class="text-[10px] text-zinc-500">v2.4 - Chatbot Décisionnelle</p>
					</div>
				</div>
				<!-- Close button on mobile -->
				<Button
					variant="ghost"
					size="icon"
					onclick={() => (isSidebarOpen = false)}
					class="lg:hidden h-8 w-8 text-zinc-400 hover:text-zinc-200"
				>
					<X size={15} />
				</Button>
			</div>

			<!-- Status Panel (Connection & Active Model) -->
			<Card class="bg-zinc-950 border-zinc-800 shadow-none">
				<CardContent class="p-4 space-y-4">
					<!-- Server Connection Status -->
					<div class="flex items-center justify-between">
						<span class="text-xs text-zinc-400 font-medium">Inférence</span>
						<div class="flex items-center gap-2">
							<span class="text-xs text-zinc-300">
								{isServerConnected ? 'Connecté' : 'Hors ligne'}
							</span>
							<span class="relative flex h-2.5 w-2.5">
								{#if isServerConnected}
									<span
										class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"
									></span>
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
								{:else}
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
								{/if}
							</span>
						</div>
					</div>

					<!-- Active Model Badge / Dropdown Selection -->
					<div class="pt-3.5 border-t border-zinc-800 flex flex-col gap-2">
						<span class="text-xs text-zinc-400 font-medium">Modèle de référence :</span>
						{#if localSimulationMode}
							<Badge
								class="bg-zinc-900 text-zinc-300 hover:bg-zinc-900 border-zinc-800 w-full justify-center py-1 text-[11px] font-mono select-none"
							>
								Modèle actuel : Phi-3.5-Financial
							</Badge>
						{:else}
							<div class="flex gap-1.5">
								<select
									value={$chatStore.model}
									onchange={(e) => chatStore.setModel(e.currentTarget.value)}
									class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono h-8"
								>
									{#each availableModels as modelName}
										<option value={modelName}>{modelName}</option>
									{/each}
								</select>
								<Button
									variant="outline"
									size="icon"
									onclick={fetchModels}
									class="h-8 w-8 border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 animate-none shrink-0"
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
						class="text-xs font-semibold text-zinc-400 flex items-center gap-1.5"
					>
						<Server size={12} class="text-zinc-500" /> URL de l'API
					</label>
					<Input
						id="api-url"
						type="text"
						bind:value={localApiUrl}
						disabled={localSimulationMode}
						class="bg-zinc-950 border-zinc-800 text-zinc-150 text-xs focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
						placeholder="https://character-viewing-employer.ngrok-free.dev/api/chat"
					/>
				</div>

				<!-- Simulation Toggle Switch -->
				<div
					class="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between"
				>
					<div class="space-y-0.5">
						<span class="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
							<Sparkles size={12} class="text-amber-500" /> Mode Simulation
						</span>
						<p class="text-[10px] text-zinc-500">Flux de réponse simulé</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={localSimulationMode}
							class="sr-only peer"
						/>
						<div
							class="relative w-9 h-5 bg-zinc-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-zinc-950"
						></div>
					</label>
				</div>
			</div>
		</div>

		<!-- Sidebar Footer -->
		<div class="p-6 border-t border-zinc-800 space-y-4">
			<div class="flex items-center gap-2 text-xs text-zinc-500">
				<ShieldCheck size={14} class="text-emerald-500" />
				<span>Inférence Sécurisée SSL</span>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={() => chatStore.clearMessages()}
				class="w-full text-xs font-semibold border-zinc-800 bg-transparent text-rose-400 hover:bg-rose-950/20 hover:text-rose-350 hover:border-rose-900 transition-colors"
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
			class="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40 lg:hidden"
		></div>
	{/if}

	<!-- 2. Main Area -->
	<main class="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
		<!-- Header -->
		<header
			class="h-16 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur flex items-center justify-between px-4 lg:px-8 z-10 shrink-0"
		>
			<div class="flex items-center gap-2.5">
				<!-- Sidebar toggle for mobile -->
				<Button
					variant="outline"
					size="icon"
					onclick={() => (isSidebarOpen = true)}
					class="lg:hidden h-8 w-8 border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 shrink-0"
					title="Ouvrir le panneau"
				>
					<Menu size={15} />
				</Button>

				<div class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
				<div>
					<h1
						class="text-xs sm:text-sm font-semibold text-zinc-150 uppercase tracking-wider line-clamp-1"
					>
						Financial Intelligence Engine
					</h1>
					<p class="text-[9px] sm:text-[10px] text-zinc-500 hidden sm:block">
						Inférence temps réel & Analyses prédictives
					</p>
				</div>
			</div>

			<div class="flex items-center gap-4 text-[10px] sm:text-xs text-zinc-450 shrink-0">
				<span class="hidden md:inline"
					>Hôte : <code class="bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] text-zinc-300"
						>{localSimulationMode ? 'Simulation locale' : new URL(localApiUrl).host}</code
					></span
				>
			</div>
		</header>

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
								class="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-md"
							>
								<MessageSquareCode size={24} />
							</div>
							<div class="space-y-2">
								<h3 class="text-sm font-semibold text-zinc-200">
									Prêt pour l'inférence financière
								</h3>
								<p class="text-xs text-zinc-455 leading-relaxed">
									Interrogez l'assistant décisionnel sur des analyses financières, des études de
									risques ou tout autre sujet. Le store gère l'état d'inférence de bout en bout.
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
									class="text-[11px] border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 py-2.5 sm:py-2"
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
									class="text-[11px] border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 py-2.5 sm:py-2"
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
											class="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 shrink-0 shadow-sm mt-0.5"
										>
											<Bot
												size={14}
												class={$chatStore.isLoading && !message.content ? 'animate-spin' : ''}
											/>
										</div>
									{/if}

									<div class="space-y-1 max-w-[88%] sm:max-w-[78%]">
										<!-- Message Bubble
                      - user: right (zinc-800)
                      - assistant: left (transparent, white text)
                    -->
										<div
											class="p-3 sm:p-4 text-xs leading-relaxed whitespace-pre-wrap transition-all
                      {message.role === 'user'
												? 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-tr-none border border-zinc-700/80 shadow-md shadow-zinc-950/20'
												: 'bg-transparent text-zinc-50 border-0 rounded-none'}"
										>
											<!-- Streaming/Loading Indicators -->
											{#if message.role === 'assistant' && !message.content && $chatStore.isLoading}
												<div class="flex items-center gap-1.5 py-1">
													<span
														class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
														style="animation-delay: 0ms"
													></span>
													<span
														class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
														style="animation-delay: 150ms"
													></span>
													<span
														class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
														style="animation-delay: 300ms"
													></span>
												</div>
											{:else}
												{message.content}
											{/if}
										</div>

										<!-- Metadata -->
										<div
											class="flex items-center gap-2 px-1 text-[10px] text-zinc-500"
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
											class="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm mt-0.5"
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
		<div class="p-4 sm:p-6 border-t border-zinc-900 bg-zinc-950 z-10 shrink-0">
			<div class="max-w-4xl mx-auto">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSend();
					}}
					class="flex gap-2 items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-lg shadow-zinc-950/40 focus-within:border-zinc-750 transition-all"
				>
					<Input
						bind:value={inputMessage}
						onkeydown={handleKeyDown}
						placeholder="Saisissez votre commande..."
						disabled={$chatStore.isLoading}
						class="flex-1 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-100 text-xs py-2 sm:py-3 px-2 sm:px-3 shadow-none placeholder-zinc-500"
					/>
					<Button
						type="submit"
						disabled={!inputMessage.trim() || $chatStore.isLoading}
						class="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-3 py-2 sm:px-4 text-xs rounded-lg transition-all shadow-sm flex items-center gap-1.5"
					>
						{#if $chatStore.isLoading}
							<Loader2 size={13} class="animate-spin text-zinc-950" />
						{/if}
						<span class="hidden sm:inline">Envoyer</span>
						{#if !$chatStore.isLoading}
							<Send size={13} class="block sm:hidden" />
						{/if}
					</Button>
				</form>
				<p class="text-[9px] sm:text-[10px] text-zinc-650 mt-2 text-center select-none">
					Inférence sécurisée de niveau entreprise • Données de transactions confidentielles
				</p>
			</div>
		</div>
	</main>
</div>
