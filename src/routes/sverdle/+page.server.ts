import { fail } from '@sveltejs/kit';
import { Game } from './game';
import type { PageServerLoad, Actions } from './$types';

import { TaskCreateInput, TaskParam } from '$lib/api';
import { makeClient } from '$lib/make-client';

export const actions = {
	addTask: async ({ fetch, request }) => {
		await new Promise(resolve => setTimeout(resolve, 1000));
		const client = makeClient(fetch);
		const form = await request.formData();
		const data = TaskCreateInput.parse(Object.fromEntries(form));
		const response = await client.tasks.$post({
			json: data
		});

		if (!response.ok) {
			return {
				message: 'An error occurred'
			};
		}

		return await response.json();
	},
	checkTask: async ({ request, fetch }) => {
		const data = TaskParam.parse(Object.fromEntries(await request.formData()));
		const client = makeClient(fetch)
		await client.tasks[':id'].check.$post({ param: { id: data.id }, json: data })
	},
	deleteTask: async ({ request, fetch }) => {
		const data = TaskParam.parse(Object.fromEntries(await request.formData()));
		const client = makeClient(fetch)
		await client.tasks[':id'].delete.$post({ param: { id: data.id } })
	},
	/**
	 * Modify game state in reaction to a keypress. If client-side JavaScript
	 * is available, this will happen in the browser instead of here
	 */
	update: async ({ request, cookies }) => {
		const game = new Game(cookies.get('sverdle'));

		const data = await request.formData();
		const key = data.get('key');

		const i = game.answers.length;

		if (key === 'backspace') {
			game.guesses[i] = game.guesses[i].slice(0, -1);
		} else {
			game.guesses[i] += key;
		}

		cookies.set('sverdle', game.toString(), { path: '/' });
	},

	/**
	 * Modify game state in reaction to a guessed word. This logic always runs on
	 * the server, so that people can't cheat by peeking at the JavaScript
	 */
	enter: async ({ request, cookies }) => {
		const game = new Game(cookies.get('sverdle'));

		const data = await request.formData();
		const guess = data.getAll('guess') as string[];

		if (!game.enter(guess)) {
			return fail(400, { badGuess: true });
		}

		cookies.set('sverdle', game.toString(), { path: '/' });
	},

	restart: async ({ cookies }) => {
		cookies.delete('sverdle', { path: '/' });
	}
} satisfies Actions;
export const load = (async ({ cookies, fetch }) => {
	const game = new Game(cookies.get('sverdle'));

	const client = makeClient(fetch);
	const tasks = await client.tasks.$get();

	return {
		tasks: await tasks.json(),
		/**
		 * The player's guessed words so far
		 */
		guesses: game.guesses,

		/**
		 * An array of strings like '__x_c' corresponding to the guesses, where 'x' means
		 * an exact match, and 'c' means a close match (right letter, wrong place)
		 */
		answers: game.answers,

		/**
		 * The correct answer, revealed if the game is over
		 */
		answer: game.answers.length >= 6 ? game.answer : null
	};
}) satisfies PageServerLoad;

