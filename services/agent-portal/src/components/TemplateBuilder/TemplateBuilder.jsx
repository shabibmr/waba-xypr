import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, Languages, X } from 'lucide-react';
import templateService from '../../services/templateService';
import MetadataEditor, { LANGUAGES } from './MetadataEditor';
import TemplatePreview from './TemplatePreview';
import HeaderEditor from './editors/HeaderEditor';
import BodyEditor from './editors/BodyEditor';
import FooterEditor from './editors/FooterEditor';
import ButtonsEditor from './editors/ButtonsEditor';
import AuthenticationEditor from './editors/AuthenticationEditor';
import CarouselEditor from './editors/CarouselEditor';

function TemplateBuilder({ template, onClose }) {
    const isEditing = !!template;

    const [name, setName] = useState(template?.name || '');
    const [category, setCategory] = useState(template?.category || 'MARKETING');
    const [language, setLanguage] = useState(template?.language || 'en_US');
    const [components, setComponents] = useState(template?.components || [
        { type: 'BODY', text: '' }
    ]);
    const [sampleValues, setSampleValues] = useState(template?.sample_values || {});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    const header = components.find(c => c.type === 'HEADER');
    const body = components.find(c => c.type === 'BODY');
    const footer = components.find(c => c.type === 'FOOTER');
    const buttons = components.find(c => c.type === 'BUTTONS');
    const carousel = components.find(c => c.type === 'CAROUSEL');

    const updateComponent = (type, data) => {
        setComponents(prev => {
            if (!data) return prev.filter(c => c.type !== type);
            const exists = prev.find(c => c.type === type);
            if (exists) return prev.map(c => c.type === type ? data : c);
            return [...prev, data];
        });
    };

    const handleMetadataChange = (changes) => {
        if (changes.name !== undefined) setName(changes.name);
        if (changes.category !== undefined) {
            setCategory(changes.category);
            // Reset components for authentication category
            if (changes.category === 'AUTHENTICATION') {
                setComponents([
                    { type: 'BODY', text: '{{1}} is your verification code.' },
                    { type: 'BUTTONS', buttons: [{ type: 'COPY_CODE', text: 'Copy Code', example: '123456' }] }
                ]);
            }
        }
        if (changes.language !== undefined) setLanguage(changes.language);
    };

    const handleSampleChange = (updates) => {
        setSampleValues(prev => ({ ...prev, ...updates }));
    };

    const handleAuthComponentsChange = (newComponents) => {
        setComponents(newComponents);
    };

    const handleSave = async () => {
        setError('');

        if (!name) { setError('Template name is required'); return; }
        if (!/^[a-z0-9_]{1,512}$/.test(name)) { setError('Invalid template name'); return; }

        const bodyComp = components.find(c => c.type === 'BODY');
        if (!bodyComp?.text) { setError('Body text is required'); return; }

        // Check sample values for all variables
        const bodyVars = (bodyComp.text.match(/\{\{(\d+)\}\}/g) || []);
        const missingSamples = bodyVars.some((_, i) => !sampleValues.body?.[i]);
        if (missingSamples) { setError('All variables must have sample values'); return; }

        setSaving(true);
        try {
            const payload = { name, category, language, components, sampleValues };
            if (isEditing) {
                await templateService.updateTemplate(template.id, payload);
            } else {
                await templateService.createTemplate(payload);
            }
            onClose(true);
        } catch (err) {
            setError(err.response?.data?.error?.message || err.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleAddLanguage = (langCode) => {
        setLanguage(langCode);
        // Clear text content but keep structure
        setComponents(components.map(c => {
            if (c.type === 'BODY') return { ...c, text: '' };
            if (c.type === 'HEADER' && c.format === 'TEXT') return { ...c, text: '' };
            if (c.type === 'FOOTER') return { ...c, text: '' };
            return c;
        }));
        setSampleValues({});
        setShowLanguageModal(false);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <button onClick={() => onClose(false)} className="p-1.5 hover:bg-gray-700 rounded transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-bold">{isEditing ? 'Edit Template' : 'Create Template'}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing && (
                        <button
                            onClick={() => setShowLanguageModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                        >
                            <Languages className="w-4 h-4" />
                            Add Language
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : isEditing ? 'Update' : 'Submit to Meta'}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mx-6 mt-3 px-4 py-2 bg-red-600/20 border border-red-600/40 rounded-lg text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Split pane: editor + preview */}
            <div className="flex-1 flex overflow-hidden">
                {/* Editor panel */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Metadata */}
                    <MetadataEditor
                        name={name}
                        category={category}
                        language={language}
                        onChange={handleMetadataChange}
                        isEditing={isEditing}
                    />

                    <hr className="border-gray-700" />

                    {/* Category-specific editors */}
                    {category === 'AUTHENTICATION' ? (
                        <AuthenticationEditor
                            components={components}
                            onChange={handleAuthComponentsChange}
                        />
                    ) : (
                        <>
                            {/* Header */}
                            <HeaderEditor
                                header={header}
                                sampleValues={sampleValues}
                                onChange={data => updateComponent('HEADER', data)}
                                onSampleChange={handleSampleChange}
                            />

                            <hr className="border-gray-700" />

                            {/* Body */}
                            <BodyEditor
                                body={body}
                                sampleValues={sampleValues}
                                onChange={data => updateComponent('BODY', data)}
                                onSampleChange={handleSampleChange}
                            />

                            <hr className="border-gray-700" />

                            {/* Footer */}
                            <FooterEditor
                                footer={footer}
                                onChange={data => updateComponent('FOOTER', data)}
                            />

                            <hr className="border-gray-700" />

                            {/* Buttons */}
                            <ButtonsEditor
                                buttons={buttons}
                                onChange={data => updateComponent('BUTTONS', data)}
                            />

                            <hr className="border-gray-700" />

                            {/* Carousel (optional) */}
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-300 transition">
                                    Carousel (optional, advanced)
                                </summary>
                                <div className="mt-3">
                                    <CarouselEditor
                                        carousel={carousel}
                                        sampleValues={sampleValues}
                                        onChange={data => updateComponent('CAROUSEL', data)}
                                        onSampleChange={handleSampleChange}
                                    />
                                </div>
                            </details>
                        </>
                    )}
                </div>

                {/* Preview panel */}
                <div className="w-80 border-l border-gray-700 bg-gray-850 p-6 overflow-y-auto flex flex-col items-center">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 self-start">Preview</h3>
                    <TemplatePreview components={components} sampleValues={sampleValues} />
                </div>
            </div>

            {/* Add Language Modal */}
            {showLanguageModal && (
                <AddLanguageModal
                    currentLanguage={language}
                    onSelect={handleAddLanguage}
                    onClose={() => setShowLanguageModal(false)}
                />
            )}
        </div>
    );
}

function AddLanguageModal({ currentLanguage, onSelect, onClose }) {
    const [search, setSearch] = useState('');
    const filtered = LANGUAGES.filter(l =>
        l.code !== currentLanguage &&
        (l.label.toLowerCase().includes(search.toLowerCase()) ||
         l.code.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                    <h3 className="font-bold text-sm">Add Language Variant</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-3">
                    <input
                        type="text"
                        placeholder="Search languages..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                </div>
                <div className="max-h-60 overflow-y-auto px-1 pb-3">
                    {filtered.map(l => (
                        <button
                            key={l.code}
                            onClick={() => onSelect(l.code)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 rounded transition"
                        >
                            {l.label} <span className="text-gray-500 ml-1">({l.code})</span>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-500">No matching languages</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TemplateBuilder;
