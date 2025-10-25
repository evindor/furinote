import type { JishoData } from '../types/index.js';

interface JishoApiResponse {
	meta: {
		status: number;
	};
	data: {
		slug: string;
		jlpt: string[];
		senses: {
			english_definitions: string[];
			parts_of_speech: string[];
		}[];
	}[];
}

class JishoService {
	private readonly baseUrl = 'https://jisho.org/api/v1/search/words';
	private readonly corsProxy = 'https://api.allorigins.win/get?url=';

	async fetchDefinition(keyword: string): Promise<JishoData | null> {
		try {
			const encodedKeyword = encodeURIComponent(keyword);
			const jishoUrl = `${this.baseUrl}?keyword=${encodedKeyword}`;
			const proxyUrl = `${this.corsProxy}${encodeURIComponent(jishoUrl)}`;

			const response = await fetch(proxyUrl);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const proxyResponse = await response.json();

			// Check if the proxy request was successful
			if (!proxyResponse.contents) {
				throw new Error('Proxy response missing contents');
			}

			// The proxy wraps the response in a 'contents' field
			const data: JishoApiResponse = JSON.parse(proxyResponse.contents);

			// Check if we have any results
			if (!data.data || data.data.length === 0) {
				return null;
			}

			// Get the first matching result
			const firstResult = data.data[0];

			// Extract only the fields we need
			const jishoData: JishoData = {
				jlpt: firstResult.jlpt || [],
				senses: firstResult.senses.map((sense) => ({
					english_definitions: sense.english_definitions,
					parts_of_speech: sense.parts_of_speech
				}))
			};

			return jishoData;
		} catch (error) {
			console.error('Error fetching definition from Jisho:', error);
			throw error;
		}
	}
}

// Create singleton instance
export const jishoService = new JishoService();
