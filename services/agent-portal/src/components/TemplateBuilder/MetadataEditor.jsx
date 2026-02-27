import React from 'react';

const CATEGORIES = [
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'UTILITY', label: 'Utility' },
    { value: 'AUTHENTICATION', label: 'Authentication' }
];

const LANGUAGES = [
    { code: 'en_US', label: 'English (US)' },
    { code: 'en_GB', label: 'English (UK)' },
    { code: 'es', label: 'Spanish' },
    { code: 'es_MX', label: 'Spanish (Mexico)' },
    { code: 'es_AR', label: 'Spanish (Argentina)' },
    { code: 'pt_BR', label: 'Portuguese (Brazil)' },
    { code: 'pt_PT', label: 'Portuguese (Portugal)' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'nl', label: 'Dutch' },
    { code: 'ru', label: 'Russian' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'zh_CN', label: 'Chinese (Simplified)' },
    { code: 'zh_TW', label: 'Chinese (Traditional)' },
    { code: 'zh_HK', label: 'Chinese (Hong Kong)' },
    { code: 'ar', label: 'Arabic' },
    { code: 'hi', label: 'Hindi' },
    { code: 'bn', label: 'Bengali' },
    { code: 'id', label: 'Indonesian' },
    { code: 'ms', label: 'Malay' },
    { code: 'th', label: 'Thai' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'tr', label: 'Turkish' },
    { code: 'pl', label: 'Polish' },
    { code: 'uk', label: 'Ukrainian' },
    { code: 'ro', label: 'Romanian' },
    { code: 'el', label: 'Greek' },
    { code: 'cs', label: 'Czech' },
    { code: 'sv', label: 'Swedish' },
    { code: 'da', label: 'Danish' },
    { code: 'fi', label: 'Finnish' },
    { code: 'nb', label: 'Norwegian' },
    { code: 'he', label: 'Hebrew' },
    { code: 'hu', label: 'Hungarian' },
    { code: 'sk', label: 'Slovak' },
    { code: 'bg', label: 'Bulgarian' },
    { code: 'hr', label: 'Croatian' },
    { code: 'sr', label: 'Serbian' },
    { code: 'sl', label: 'Slovenian' },
    { code: 'lt', label: 'Lithuanian' },
    { code: 'lv', label: 'Latvian' },
    { code: 'et', label: 'Estonian' },
    { code: 'fil', label: 'Filipino' },
    { code: 'ta', label: 'Tamil' },
    { code: 'te', label: 'Telugu' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'kn', label: 'Kannada' },
    { code: 'mr', label: 'Marathi' },
    { code: 'gu', label: 'Gujarati' },
    { code: 'pa', label: 'Punjabi' },
    { code: 'ur', label: 'Urdu' },
    { code: 'af', label: 'Afrikaans' },
    { code: 'sw', label: 'Swahili' },
    { code: 'zu', label: 'Zulu' },
    { code: 'ha', label: 'Hausa' },
    { code: 'ka', label: 'Georgian' },
    { code: 'az', label: 'Azerbaijani' },
    { code: 'uz', label: 'Uzbek' },
    { code: 'kk', label: 'Kazakh' },
    { code: 'sq', label: 'Albanian' },
    { code: 'mk', label: 'Macedonian' },
    { code: 'bs', label: 'Bosnian' },
    { code: 'lo', label: 'Lao' },
    { code: 'km', label: 'Khmer' },
    { code: 'my', label: 'Burmese' },
    { code: 'am', label: 'Amharic' },
    { code: 'rw_RW', label: 'Kinyarwanda' }
];

function MetadataEditor({ name, category, language, onChange, isEditing }) {
    const [langSearch, setLangSearch] = React.useState('');
    const [showLangDropdown, setShowLangDropdown] = React.useState(false);

    const filteredLanguages = LANGUAGES.filter(l =>
        l.label.toLowerCase().includes(langSearch.toLowerCase()) ||
        l.code.toLowerCase().includes(langSearch.toLowerCase())
    );

    const selectedLangLabel = LANGUAGES.find(l => l.code === language)?.label || language;

    const nameValid = /^[a-z0-9_]{0,512}$/.test(name);

    return (
        <div className="space-y-4">
            {/* Template Name */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={e => onChange({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    disabled={isEditing}
                    placeholder="e.g. order_confirmation"
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm focus:outline-none ${
                        name && !nameValid ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'
                    } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                    maxLength={512}
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only</p>
            </div>

            {/* Category */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                <select
                    value={category}
                    onChange={e => onChange({ category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                    {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
            </div>

            {/* Language */}
            <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-1">Language</label>
                <button
                    type="button"
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    disabled={isEditing}
                    className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-left focus:outline-none focus:border-blue-500 ${
                        isEditing ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                >
                    {selectedLangLabel}
                </button>
                {showLangDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <input
                            type="text"
                            placeholder="Search languages..."
                            value={langSearch}
                            onChange={e => setLangSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border-b border-gray-600 text-sm focus:outline-none"
                            autoFocus
                        />
                        <div className="max-h-48 overflow-y-auto">
                            {filteredLanguages.map(l => (
                                <button
                                    key={l.code}
                                    onClick={() => { onChange({ language: l.code }); setShowLangDropdown(false); setLangSearch(''); }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition ${
                                        l.code === language ? 'bg-blue-600/20 text-blue-400' : ''
                                    }`}
                                >
                                    {l.label} <span className="text-gray-500 ml-1">({l.code})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export { LANGUAGES };
export default MetadataEditor;
