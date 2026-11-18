#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <tlhelp32.h>

#include <array>
#include <cstdint>
#include <cstring>
#include <cwchar>
#include <filesystem>
#include <sstream>
#include <string>

namespace fs = std::filesystem;

struct Handle {
    HANDLE value = nullptr;
    explicit Handle(HANDLE handle) : value(handle) {}
    ~Handle() { if (*this) CloseHandle(value); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
};

struct Profile {
    const wchar_t* exe;
    const char* game;
    const char* build;
    uint32_t timestamp, imageSize, save, gil, formation, stats, items;
    bool sequel;
};

// Layouts are selected by the game image's PE build identity. See README for provenance.
constexpr Profile profiles[] = {
    {L"FFX.exe", "x", "Steam 2026", 0x6aa2219c, 0x237d000, 0xd2ca90,
        0xd307d8, 0xd307e8, 0xd32060, 0xd3095c, false},
    {L"FFX-2.exe", "x2", "Steam 2026", 0x6aa2217b, 0x1c13000, 0x9f7510,
        0x9ffce8, 0x9ffcf8, 0xa006c0, 0x9ffe50, true},
};

template<class T>
bool read(HANDLE process, uintptr_t address, T& value) {
    SIZE_T length = 0;
    return ReadProcessMemory(process, reinterpret_cast<const void*>(address),
        &value, sizeof(value), &length) && length == sizeof(value);
}

template<class T, size_t N>
T at(const std::array<uint8_t, N>& bytes, size_t offset) {
    T value;
    std::memcpy(&value, bytes.data() + offset, sizeof(value));
    return value;
}

uint64_t unixMillis() {
    FILETIME now;
    GetSystemTimeAsFileTime(&now);
    ULARGE_INTEGER ticks;
    ticks.LowPart = now.dwLowDateTime;
    ticks.HighPart = now.dwHighDateTime;
    return (ticks.QuadPart - 116444736000000000ULL) / 10000;
}

DWORD processId(const wchar_t* name) {
    Handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0));
    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (snapshot && Process32FirstW(snapshot.value, &entry)) {
        do {
            if (_wcsicmp(name, entry.szExeFile) == 0) return entry.th32ProcessID;
        } while (Process32NextW(snapshot.value, &entry));
    }
    return 0;
}
uintptr_t moduleBase(DWORD pid, const wchar_t* name) {
    Handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid));
    MODULEENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (snapshot && Module32FirstW(snapshot.value, &entry)) {
        do {
            if (_wcsicmp(name, entry.szModule) == 0) {
                return reinterpret_cast<uintptr_t>(entry.modBaseAddr);
            }
        } while (Module32NextW(snapshot.value, &entry));
    }
    return 0;
}

bool matches(HANDLE process, uintptr_t base, const Profile& p) {
    IMAGE_DOS_HEADER dos{};
    IMAGE_NT_HEADERS32 nt{};
    return read(process, base, dos) && dos.e_magic == IMAGE_DOS_SIGNATURE &&
        dos.e_lfanew > 0 && dos.e_lfanew < 4096 &&
        read(process, base + dos.e_lfanew, nt) && nt.Signature == IMAGE_NT_SIGNATURE &&
        nt.FileHeader.Machine == IMAGE_FILE_MACHINE_I386 &&
        nt.OptionalHeader.Magic == IMAGE_NT_OPTIONAL_HDR32_MAGIC &&
        nt.FileHeader.TimeDateStamp == p.timestamp && nt.OptionalHeader.SizeOfImage == p.imageSize;
}

std::string sample(HANDLE process, uintptr_t base, const Profile& p) {
    uint16_t room = 0, story = 0;
    uint32_t gil = 0, battles = 0;
    uint8_t chapter = 0;
    std::array<uint8_t, 20> formation{};
    std::array<uint16_t, 256> ids{};
    std::array<uint8_t, 256> counts{};
    const auto save = base + p.save;
    if (!read(process, save, room) || !read(process, save + 0xbec, story) ||
        !read(process, base + p.gil, gil) || !read(process, base + p.formation, formation) ||
        !read(process, base + p.items, ids) || !read(process, base + p.items + sizeof(ids), counts) ||
        !read(process, save + (p.sequel ? 0x77e4 : 0x3d14), battles) ||
        (p.sequel && !read(process, save + 0x114c, chapter))) return R"("status":"reading")";

    // Both title screens initialize some party fields before a save is loaded.
    const bool playing = room != 0 && (p.sequel ? chapter >= 1 && chapter <= 5 : story != 0);
    if (!playing) return R"("status":"title")";

    std::ostringstream out;
    out << R"("status":"live","room":)" << room << R"(,"story":)" << story
        << R"(,"gil":)" << gil << R"(,"battles":)" << battles;
    if (p.sequel) out << R"(,"chapter":)" << unsigned(chapter);
    out << R"(,"party":[)";
    bool first = true;
    std::array<bool, 16> seen{};
    for (size_t slot = 0; slot < (p.sequel ? 3u : formation.size()); ++slot) {
        const unsigned id = formation[slot];
        const unsigned statCount = p.sequel ? 11 : 8;
        if (id >= statCount || seen[id]) continue;
        seen[id] = true;
        const auto address = base + p.stats + id * (p.sequel ? 0x80 : 0x94);
        std::array<uint8_t, 0x40> stats{};
        if (!read(process, address, stats)) return R"("status":"reading")";
        const auto hpOffset = p.sequel ? 0x1c : 0x18;
        const auto hp = at<uint32_t>(stats, hpOffset);
        const auto mp = at<uint32_t>(stats, hpOffset + 4);
        const auto maxHp = at<uint32_t>(stats, hpOffset + 8);
        const auto maxMp = at<uint32_t>(stats, hpOffset + 12);
        if (maxHp == 0 || hp > maxHp || mp > maxMp || maxHp > 999999 || maxMp > 99999) continue;
        if (!first) out << ',';
        first = false;
        out << R"({"id":)" << id << R"(,"active":)" << (slot < 3 ? "true" : "false")
            << R"(,"hp":)" << hp << R"(,"mp":)" << mp
            << R"(,"maxHp":)" << maxHp << R"(,"maxMp":)" << maxMp;
        if (p.sequel) {
            out << R"(,"level":)" << unsigned(stats[0x35])
                << R"(,"job":)" << at<uint16_t>(stats, 0x36);
        } else {
            out << R"(,"sphereLevel":)" << unsigned(stats[0x37])
                << R"(,"overdrive":)" << unsigned(stats[0x35])
                << R"(,"overdriveMax":)" << unsigned(stats[0x36]);
        }
        out << '}';
    }
    out << R"(],"items":[)";
    first = true;
    for (size_t i = 0; i < ids.size(); ++i) {
        if (counts[i] == 0 || counts[i] > 99 || (ids[i] & 0xf000) != 0x2000) continue;
        if (!first) out << ',';
        first = false;
        out << '[' << ids[i] << ',' << unsigned(counts[i]) << ']';
    }
    out << ']';
    return out.str();
}

std::string frame(const Profile* profile, DWORD pid, uintptr_t& base) {
    std::ostringstream out;
    out << R"({"schema":1,"timestamp":)" << unixMillis();
    if (profile) {
        out << R"(,"game":")" << profile->game << R"(","build":")" << profile->build << "\",";
        Handle process(OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, FALSE, pid));
        if (base == 0) base = moduleBase(pid, profile->exe);
        if (!process || base == 0) out << R"("status":"reading")";
        else if (!matches(process.value, base, *profile)) out << R"("status":"unsupported")";
        else out << sample(process.value, base, *profile);
    } else {
        out << R"(,"status":"waiting")";
    }
    out << "}\n";
    return out.str();
}

bool publish(const fs::path& path, const std::string& frame) {
    auto temp = path;
    temp += L".tmp";
    {
        Handle file(CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
            FILE_ATTRIBUTE_NORMAL, nullptr));
        if (!file) return false;
        DWORD written = 0;
        const auto size = static_cast<DWORD>(frame.size());
        if (!WriteFile(file.value, frame.data(), size, &written, nullptr) || written != size) return false;
    }
    return MoveFileExW(temp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING);
}

fs::path outputPath() {
    if (GetFileAttributesW(L"D:\\") != INVALID_FILE_ATTRIBUTES && GetModuleHandleW(L"ntdll.dll") &&
        GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "wine_get_version")) {
        return LR"(D:\SpiraCompanion\live.json)";
    }
    wchar_t home[32768];
    const DWORD length = GetEnvironmentVariableW(L"USERPROFILE", home, ARRAYSIZE(home));
    if (length == 0 || length >= ARRAYSIZE(home)) return {};
    return fs::path(home) / L"Downloads" / L"SpiraCompanion" / L"live.json";
}

bool launch(const fs::path& directory, const wchar_t* exe) {
    const auto path = directory / exe;
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(path.c_str(), nullptr, nullptr, nullptr, FALSE, 0, nullptr,
            directory.c_str(), &startup, &process)) {
        MessageBoxW(nullptr, L"Put SpiraBridge.exe beside the Steam game executables.",
            L"Spira Companion", MB_OK | MB_ICONERROR);
        return false;
    }
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return true;
}

int wmain(int argc, wchar_t** argv) {
    bool watch = false, once = false;
    fs::path output = outputPath();
    const wchar_t* game = L"FFX&X-2_LAUNCHER.exe";
    for (int i = 1; i < argc; ++i) {
        const std::wstring arg = argv[i];
        if (arg == L"--watch") watch = true;
        else if (arg == L"--once") once = true;
        else if (arg == L"--x") game = profiles[0].exe;
        else if (arg == L"--x2") game = profiles[1].exe;
        else if (arg == L"--out" && i + 1 < argc) output = argv[++i];
        else return 2;
    }
    if (output.empty()) return 2;
    std::error_code error;
    if (output.has_parent_path()) fs::create_directories(output.parent_path(), error);
    if (error) return 3;
    wchar_t self[MAX_PATH];
    const auto length = GetModuleFileNameW(nullptr, self, ARRAYSIZE(self));
    if (!length || length >= ARRAYSIZE(self)) return 3;
    if (!watch && !once && !launch(fs::path(self).parent_path(), game)) return 4;

    DWORD previousPid = 0;
    uintptr_t base = 0;
    ULONGLONG idleSince = GetTickCount64();
    do {
        const Profile* profile = nullptr;
        DWORD pid = 0;
        for (const auto& candidate : profiles) {
            pid = processId(candidate.exe);
            if (pid) {
                profile = &candidate;
                break;
            }
        }
        if (pid != previousPid) base = 0;
        previousPid = pid;
        if (!publish(output, frame(profile, pid, base)) && once) return 3;
        if (pid || processId(L"FFX&X-2_LAUNCHER.exe")) idleSince = GetTickCount64();
        if (once) break;
        Sleep(pid ? 300 : 700);
    } while (watch || GetTickCount64() - idleSince < 15000);
    return 0;
}
