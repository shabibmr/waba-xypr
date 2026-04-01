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

        // Validate buttons have required fields
        const buttonsComp = components.find(c => c.type === 'BUTTONS');
        if (buttonsComp?.buttons) {
            for (const btn of buttonsComp.buttons) {
                if (['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(btn.type) && !btn.text) {
                    setError(`Button "${btn.type}" requires text`); return;
                }
                if (btn.type === 'URL' && !btn.url) {
                    setError('URL button requires a URL'); return;
                }
                if (btn.type === 'PHONE_NUMBER' && !btn.phone_number) {
                    setError('Phone button requires a phone number'); return;
                }
            }
        }

        // Validate media header has been uploaded
        const headerComp = components.find(c => c.type === 'HEADER');
        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format) && !sampleValues.headerHandle) {
            setError('Please upload the header media file'); return;
        }

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
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-200">
                <div className="flex items-center gap-3">
                    <button onClick={() => onClose(false)} className="p-2 hover:bg-surface-100 rounded-lg text-surface-600 hover:text-surface-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold text-surface-900">{isEditing ? 'Edit Template' : 'Create Template'}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing && (
                        <button
                            onClick={() => setShowLanguageModal(true)}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <Languages className="w-4 h-4" />
                            Add Language
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : isEditing ? 'Update' : 'Submit to Meta'}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    {error}
                </div>
            )}

            {/* Split pane: editor + preview */}
            <div className="flex-1 flex overflow-hidden">
                {/* Editor panel */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface-50">
                    {/* Metadata */}
                    <MetadataEditor
                        name={name}
                        category={category}
                        language={language}
                        onChange={handleMetadataChange}
                        isEditing={isEditing}
                    />

                    {/* Category-specific editors */}
                    {category === 'AUTHENTICATION' ? (
                        <AuthenticationEditor
                            components={components}
                            onChange={handleAuthComponentsChange}
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* Header */}
                            <HeaderEditor
                                header={header}
                                sampleValues={sampleValues}
                                onChange={data => updateComponent('HEADER', data)}
                                onSampleChange={handleSampleChange}
                            />

                            {/* Body */}
                            <BodyEditor
                                body={body}
                                sampleValues={sampleValues}
                                onChange={data => updateComponent('BODY', data)}
                                onSampleChange={handleSampleChange}
                            />

                            {/* Footer */}
                            <FooterEditor
                                footer={footer}
                                onChange={data => updateComponent('FOOTER', data)}
                            />

                            {/* Buttons */}
                            <ButtonsEditor
                                buttons={buttons}
                                onChange={data => updateComponent('BUTTONS', data)}
                            />

                            {/* Carousel (optional) */}
                            <details className="group bg-white rounded-xl border border-surface-200 overflow-hidden">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-600 hover:bg-surface-50 transition-colors flex items-center justify-between">
                                    <span>Advanced: Carousel (optional)</span>
                                    <ArrowLeft className="w-4 h-4 -rotate-90 group-open:rotate-90 transition-transform" />
                                </summary>
                                <div className="p-4 border-t border-surface-100">
                                    <CarouselEditor
                                        carousel={carousel}
                                        sampleValues={sampleValues}
                                        onChange={data => updateComponent('CAROUSEL', data)}
                                        onSampleChange={handleSampleChange}
                                    />
                                </div>
                            </details>
                        </div>
                    )}
                </div>

                {/* Preview panel */}
                <div className="w-96 border-l border-surface-200 bg-white p-6 overflow-y-auto flex flex-col items-center shadow-inner-light">
                    <h3 className="text-xs font-bold text-surface-400 mb-6 self-start uppercase tracking-widest pl-2">Template Preview</h3>
                    <div className="sticky top-0">
                        <TemplatePreview components={components} sampleValues={sampleValues} />
                    </div>
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
        <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in-right">
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <h3 className="font-bold text-lg text-surface-900">Add Language Variant</h3>
                    <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-lg text-surface-400 hover:text-surface-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">
                    <input
                        type="text"
                        placeholder="Search languages..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input-field w-full"
                        autoFocus
                    />
                </div>
                <div className="max-h-80 overflow-y-auto px-2 pb-4">
                    {filtered.map(l => (
                        <button
                            key={l.code}
                            onClick={() => onSelect(l.code)}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-50 rounded-xl transition-colors group flex items-center justify-between"
                        >
                            <span className="font-medium text-surface-700 group-hover:text-primary-600">{l.label}</span>
                            <span className="text-surface-400 text-xs font-mono">{l.code}</span>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="px-4 py-8 text-center">
                            <p className="text-sm text-surface-400">No matching languages found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TemplateBuilder;
