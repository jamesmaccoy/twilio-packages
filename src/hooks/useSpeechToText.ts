import { useEffect, useRef, useState } from 'react'

// Lightweight browser speech recognition helper for client components
// Uses Web Speech API where available (SpeechRecognition / webkitSpeechRecognition)

interface UseSpeechToTextOptions {
	onFinal?: (text: string) => void
	onInterim?: (text: string) => void
	lang?: string
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
	const [isListening, setIsListening] = useState(false)
	const [micError, setMicError] = useState<string | null>(null)
	const recognitionRef = useRef<any>(null)

	useEffect(() => {
		if (typeof window === 'undefined') return

		const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
		if (!SR) {
			setMicError('Speech recognition is not supported in this browser.')
			return
		}

		const rec: any = new SR()
		rec.continuous = true
		rec.interimResults = true
		rec.lang = options.lang || 'en-US'

		rec.onresult = (event: any) => {
			let interim = ''
			let final = ''
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i]
				if (result && result[0]) {
					const transcript = result[0].transcript as string
					if (result.isFinal) final += transcript
					else interim += transcript
				}
			}
			if (interim && options.onInterim) options.onInterim(interim)
			if (final && options.onFinal) options.onFinal(final)
		}

		rec.onend = () => {
			if (isListening) {
				try {
					rec.start()
				} catch {
					// ignore restart errors
				}
			}
		}

		rec.onerror = () => {
			setMicError('Speech recognition error.')
			setIsListening(false)
		}

		recognitionRef.current = rec

		return () => {
			try {
				recognitionRef.current?.stop()
			} catch {
				// ignore stop errors
			}
		}
		// It is intentional that we do not include callbacks in deps to avoid reinitializing SR
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isListening, options.lang])

	const startListening = () => {
		const rec = recognitionRef.current
		if (!rec) return
		try {
			rec.start()
			setIsListening(true)
			setMicError(null)
		} catch {
			setMicError('Failed to start microphone.')
		}
	}

	const stopListening = () => {
		const rec = recognitionRef.current
		if (!rec) return
		try {
			rec.stop()
			setIsListening(false)
		} catch {
			setMicError('Failed to stop microphone.')
		}
	}

	return { startListening, stopListening, isListening, micError }
}
