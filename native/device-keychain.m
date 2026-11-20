#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <fcntl.h>
#include <pwd.h>
#include <sys/stat.h>
#include <unistd.h>

static int result(OSStatus status) {
  fprintf(stderr, "security-status:%d\n", (int)status);
  if (status == errSecItemNotFound) return 2;
  if (status == errSecInteractionNotAllowed || status == errSecAuthFailed ||
      status == errSecNotAvailable || status == errSecNoSuchKeychain) return 3;
  return 4;
}

static bool private_file(int fd, off_t bytes) {
  struct stat info;
  return fstat(fd, &info) == 0 && S_ISREG(info.st_mode) && info.st_uid == getuid() &&
    info.st_nlink == 1 && (info.st_mode & 0777) == 0600 && (bytes == 0 || info.st_size == bytes);
}

static bool matches(NSString *text, NSString *pattern) {
  return text && [text rangeOfString:pattern options:NSRegularExpressionSearch].location != NSNotFound;
}

static bool private_directory(NSString *path) {
  struct stat info;
  char *canonical = realpath(path.fileSystemRepresentation, NULL);
  const bool accepted = canonical && strcmp(canonical, path.fileSystemRepresentation) == 0 &&
    lstat(canonical, &info) == 0 && S_ISDIR(info.st_mode) && info.st_uid == getuid() &&
    (info.st_mode & 0777) == 0700;
  free(canonical);
  return accepted;
}

static bool allowed_parent(NSString *path, bool init) {
  if ([path isEqualToString:@"/private/tmp"]) return true;
  if (init) return false;
  const struct passwd *account = getpwuid(getuid());
  if (!account || !account->pw_dir) return false;
  NSString *allowed = [@(account->pw_dir) stringByAppendingPathComponent:@".dsh-pet-hub-enrollment"];
  return [path isEqualToString:allowed] && private_directory(path);
}

static int write_data(CFDataRef value, CFIndex low, CFIndex high) {
  if (!value) return 4;
  const CFIndex size = CFDataGetLength(value);
  const int rc = size >= low && size <= high &&
    fwrite(CFDataGetBytePtr(value), 1, (size_t)size, stdout) == (size_t)size && fflush(stdout) == 0 ? 0 : 4;
  CFRelease(value);
  return rc;
}

static OSStatus find_key(SecKeychainRef chain, NSData *tag, SecKeyRef *key) {
  NSDictionary *query = @{(__bridge id)kSecClass: (__bridge id)kSecClassKey,
    (__bridge id)kSecAttrKeyClass: (__bridge id)kSecAttrKeyClassPrivate,
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecAttrApplicationTag: tag, (__bridge id)kSecReturnRef: @YES,
    (__bridge id)kSecMatchSearchList: @[(__bridge id)chain], (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitAll};
  CFTypeRef found = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &found);
  if (status != errSecSuccess) return status;
  NSArray *items = CFBridgingRelease(found);
  if (![items isKindOfClass:[NSArray class]] || items.count != 1 ||
      CFGetTypeID((__bridge CFTypeRef)items[0]) != SecKeyGetTypeID()) return errSecDuplicateItem;
  *key = (SecKeyRef)CFRetain((__bridge CFTypeRef)items[0]);
  return errSecSuccess;
}

static int operate(SecKeychainRef chain, NSString *operation, NSString *reference, NSString *name) {
  NSData *tag = [reference dataUsingEncoding:NSASCIIStringEncoding];
  SecKeyRef key = NULL;
  OSStatus status = find_key(chain, tag, &key);
  if (status == errSecItemNotFound && [operation isEqualToString:@"prepare"]) {
    NSDictionary *attributes = @{
      (__bridge id)kSecUseKeychain: (__bridge id)chain,
      (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
      (__bridge id)kSecAttrKeySizeInBits: @256,
      (__bridge id)kSecPublicKeyAttrs: @{(__bridge id)kSecAttrIsPermanent: @NO},
      (__bridge id)kSecPrivateKeyAttrs: @{(__bridge id)kSecAttrIsPermanent: @YES,
        (__bridge id)kSecAttrApplicationTag: tag, (__bridge id)kSecAttrLabel: name,
        (__bridge id)kSecAttrIsExtractable: @NO, (__bridge id)kSecAttrCanSign: @YES}};
    CFErrorRef error = NULL;
    key = SecKeyCreateRandomKey((__bridge CFDictionaryRef)attributes, &error);
    if (!key) {
      const int rc = result(error ? (OSStatus)CFErrorGetCode(error) : errSecInternalError);
      if (error) CFRelease(error);
      return rc;
    }
    CFRelease(key);
    status = find_key(chain, tag, &key);
  }
  if (status != errSecSuccess) return result(status);
  int rc;
  if ([operation isEqualToString:@"sign"]) {
    unsigned char data[257];
    size_t count = fread(data, 1, sizeof data, stdin);
    if (ferror(stdin) || count < 1 || count > 256) { CFRelease(key); return 4; }
    CFDataRef message = CFDataCreate(kCFAllocatorDefault, data, (CFIndex)count);
    CFErrorRef error = NULL;
    CFDataRef signature = SecKeyCreateSignature(key, kSecKeyAlgorithmECDSASignatureMessageX962SHA256, message, &error);
    rc = signature ? write_data(signature, 8, 72) : result(error ? (OSStatus)CFErrorGetCode(error) : errSecInternalError);
    if (error) CFRelease(error);
    CFRelease(message);
  } else {
    SecKeyRef public_key = SecKeyCopyPublicKey(key);
    rc = public_key ? write_data(SecKeyCopyExternalRepresentation(public_key, NULL), 65, 65) : 4;
    if (public_key) CFRelease(public_key);
  }
  CFRelease(key);
  return rc;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 3 && argc != 4) return 4;
    NSString *operation = @(argv[1]);
    bool init = [operation isEqualToString:@"init"], health = [operation isEqualToString:@"health"];
    NSString *reference = argc == 4 ? @(argv[3]) : nil;
    NSString *path = @(argv[2]), *parent = [path stringByDeletingLastPathComponent];
    NSString *scope = parent.lastPathComponent;
    if (![path isAbsolutePath] || ![path.lastPathComponent isEqualToString:@"enrollment.keychain-db"] ||
        !allowed_parent(parent.stringByDeletingLastPathComponent, init) ||
        !matches(scope, @"^device-enrollment-[a-f0-9]{32}$") ||
        ((init || health) ? argc != 3 : !matches(reference, @"^vp8-[a-f0-9]{32}-[a-f0-9]{32}$")) ||
        (!(init || health) && ![@[@"prepare", @"lookup", @"sign"] containsObject:operation])) return 4;
    if (reference && ![reference hasPrefix:[@"vp8-" stringByAppendingString:[scope substringFromIndex:[@"device-enrollment-" length]]]]) return 4;
    struct stat old;
    if (!private_directory(parent) || !private_file(3, 64)) return 4;
    if (lstat(argv[2], &old) == 0) {
      if (init || !S_ISREG(old.st_mode) || old.st_uid != getuid() || old.st_nlink != 1 ||
          (old.st_mode & 077) != 0) return 4;
    } else if (errno != ENOENT || !init) return 4;
    unsigned char password[64];
    if (pread(3, password, sizeof password, 0) != sizeof password) return 4;
    if (SecKeychainSetUserInteractionAllowed(false) != errSecSuccess) return 4;
    umask(0077);
    SecKeychainRef chain = NULL;
    OSStatus status = init ? SecKeychainCreate(argv[2], sizeof password, password, false, NULL, &chain) :
      SecKeychainOpen(argv[2], &chain);
    if (status == errSecSuccess && !init) status = SecKeychainUnlock(chain, sizeof password, password, true);
    memset_s(password, sizeof password, 0, sizeof password);
    if (status != errSecSuccess) {
      if (chain) CFRelease(chain);
      return result(status);
    }
    // Explicit path and a one-entry search list keep lookup local to this review.
    int rc = init || health ? 0 : operate(chain, operation, reference, scope);
    CFRelease(chain);
    return rc;
  }
}
