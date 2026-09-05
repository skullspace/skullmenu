export default function CategoryIcon({ name }) {
    const n = name || '';

    if (n.includes('Non-Alcoholic')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 3h8l-1 6.5c2 1.3 3 3.2 3 5.5a6 6 0 0 1-12 0c0-2.3 1-4.2 3-5.5Z" />
                <path d="M3 3l18 18" />
            </svg>
        );
    }

    if (n.includes('Mixed')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h16l-6.5 8v6.5h3.5V21h-9v-2.5H11.5V12Z" />
            </svg>
        );
    }

    if (n.includes('Alcohol')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M7 9h10v10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5Z" />
                <path d="M7 9 6.3 5.2A1 1 0 0 1 7.28 4h9.44a1 1 0 0 1 .98 1.2L17 9" />
                <path d="M9.5 4V2.6c0-.33.27-.6.6-.6h3.8c.33 0 .6.27.6.6V4" />
            </svg>
        );
    }

    // Food / fallback
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 10 12 3l9 7" />
            <path d="M4.5 9.5 12 21l7.5-11.5" />
            <path d="M4.5 9.5h15" />
        </svg>
    );
}
