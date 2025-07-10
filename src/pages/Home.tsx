import {
  AccountId,
  PublicKey,
  PrivateKey,
} from "@hashgraph/sdk";
import {
  Stack,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";
import {
  hc,
} from "../services/hashconnect";
import { AppStore } from "../store";

export const Home = () => {
  const { accountIds: connectedAccountIds, isConnected } = useSelector(
    (state: AppStore) => state.hashconnect
  );

  const aliasPayload = {
    types: {
      Alias: [
        { name: "from", type: "address" },
        { name: "alias", type: "address" },
        { name: "timestamp", type: "uint64" }
      ]
    },
    domain: {
      name: "snapshot",
      version: "0.1.4"
    },
    primaryType: "Alias",
    message: {
      from: "0x757a20e145435b5bdaf0e274987653aecd47cf37",
      alias: "0x15730d8947acb69b080d387411d05057e5f6b4a6",
      timestamp: "1752082694"
    }
  };

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [signature, setSignature] = useState("");
  const [verificationResult, setVerificationResult] = useState("");
  const [testWallet, setTestWallet] = useState<{privateKey: PrivateKey, publicKey: PublicKey, accountId: string} | null>(null);

  const createTestWallet = () => {
    const privateKey = PrivateKey.generateED25519();
    const publicKey = privateKey.publicKey;
    
    // Derive account number from public key bytes
    const publicKeyBytes = publicKey.toBytesRaw();
    const accountNumber = Math.abs(publicKeyBytes.reduce((acc, byte, index) => acc + byte * (index + 1), 0)) % 10000000;
    const accountId = `0.0.${accountNumber}`;
    
    setTestWallet({ privateKey, publicKey, accountId });
    setSelectedAccountId(accountId);
    setSignature("");
    setVerificationResult("");
  };

  const handleSignText = async () => {
    if (!selectedAccountId) {
      alert("Please select an account");
      return;
    }

    try {
      const messageString = JSON.stringify(aliasPayload);
      const messageBytes = new TextEncoder().encode(messageString);

      if (testWallet && selectedAccountId === testWallet.accountId) {
        // Use test wallet for signing
        const signature = testWallet.privateKey.sign(messageBytes);
        
        setSignature(JSON.stringify({
          signature: Buffer.from(signature).toString('hex'),
          publicKey: testWallet.publicKey.toString(),
          accountId: selectedAccountId
        }));
      } else {
        // Use HashPack wallet
        const signer = hc.getSigner(AccountId.fromString(selectedAccountId));
        const signedMessages = await signer.sign([messageBytes]);
        const signatureResult = signedMessages[0];
        
        // Create a clean copy of the signature to avoid buffer offset issues
        const cleanSignature = new Uint8Array(signatureResult.signature);
        
        setSignature(JSON.stringify({
          signature: Buffer.from(cleanSignature).toString('hex'),
          publicKey: signatureResult.publicKey.toString(),
          accountId: selectedAccountId
        }));
      }
      
      setVerificationResult(""); // Reset verification result
    } catch (error) {
      console.error("Error signing text:", error);
      alert("Error signing text. Please try again.");
    }
  };

  const prefixMessageToSign = (message: string) => {
    return '\x19Hedera Signed Message:\n' + message.length + message;
  };

  const handleVerifySignature = async () => {
    if (!selectedAccountId || !signature) {
      alert("Please sign a message first");
      return;
    }

    try {
      const messageString = JSON.stringify(aliasPayload);
      const signatureData = JSON.parse(signature);
      
      if (testWallet && selectedAccountId === testWallet.accountId) {
        // For test wallet, use direct verification
        const messageBytes = new TextEncoder().encode(messageString);
        const signatureBytes = new Uint8Array(Buffer.from(signatureData.signature, 'hex'));
        const publicKey = PublicKey.fromString(signatureData.publicKey);
        
        const isValid = publicKey.verify(messageBytes, signatureBytes);
        setVerificationResult(isValid ? "✅ Signature is VALID (Test Wallet)" : "❌ Signature is INVALID");
      } else {
        // For HashPack wallet, use prefixed message verification
        const prefixedMessage = prefixMessageToSign(messageString);
        const prefixedMessageBytes = new TextEncoder().encode(prefixedMessage);
        const signatureBytes = new Uint8Array(Buffer.from(signatureData.signature, 'hex'));
        const publicKey = PublicKey.fromString(signatureData.publicKey);
        
        const isValid = publicKey.verify(prefixedMessageBytes, signatureBytes);
        setVerificationResult(isValid ? "✅ Signature is VALID (HashPack with prefix)" : "❌ Signature is INVALID");
      }
      
    } catch (error) {
      console.error("Error verifying signature:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setVerificationResult("❌ Verification failed: " + errorMessage);
    }
  };

  return (
    <Stack spacing={1}>
      <Typography variant="h2">Connected Accounts</Typography>
      {connectedAccountIds.map((accountId) => (
        <Box key={accountId}>
          <Typography>Account ID: {accountId}</Typography>
        </Box>
      ))}
      {!isConnected && <Typography>NONE</Typography>}
      {(isConnected || testWallet) && (
        <Stack maxWidth="400px" spacing={1} pt={8}>
          <Typography variant="h3">Sign Alias Payload</Typography>
          
          <Button
            variant="outlined"
            color={"blurple" as any}
            onClick={createTestWallet}
            sx={{ mb: 2 }}
          >
            Create Test Wallet (for testing)
          </Button>
          
          <Typography>Select Account:</Typography>
          <Select
            color={"blurple" as any}
            variant="standard"
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSignature(""); // Clear signature when account changes
              setVerificationResult(""); // Clear verification result
            }}
            displayEmpty
            sx={
              selectedAccountId
                ? {}
                : {
                    "& .MuiSelect-select": {
                      color: "#7d7c84",
                    },
                  }
            }
            renderValue={(value) => (value ? value : "Select Account ID")}
          >
            {connectedAccountIds.map((accountId) => (
              <MenuItem key={accountId} value={accountId}>
                {accountId} (HashPack)
              </MenuItem>
            ))}
            {testWallet && (
              <MenuItem value={testWallet.accountId}>
                {testWallet.accountId} (Test Wallet)
              </MenuItem>
            )}
          </Select>

          <Typography>Payload to Sign:</Typography>
          <TextField
            color={"blurple" as any}
            variant="standard"
            multiline
            rows={8}
            value={JSON.stringify(aliasPayload, null, 2)}
            InputProps={{
              readOnly: true,
            }}
            fullWidth
          />
          
          <Button
            variant="contained"
            color={"blurple" as any}
            onClick={handleSignText}
            disabled={!selectedAccountId}
          >
            Sign Alias Payload
          </Button>

          {signature && (
            <Box>
              <Typography variant="h4" pt={2}>Selected Account ID:</Typography>
              <TextField
                color={"blurple" as any}
                variant="standard"
                value={selectedAccountId}
                InputProps={{
                  readOnly: true,
                }}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Typography variant="h4" pt={2}>Signature:</Typography>
              <TextField
                color={"blurple" as any}
                variant="standard"
                multiline
                rows={4}
                value={signature}
                InputProps={{
                  readOnly: true,
                }}
                fullWidth
              />
              
              <Button
                variant="outlined"
                color={"blurple" as any}
                onClick={handleVerifySignature}
                sx={{ mt: 2 }}
              >
                Verify Signature
              </Button>
              
              {verificationResult && (
                <Box pt={2}>
                  <Typography variant="h5" color={verificationResult.includes("VALID") ? "success.main" : "error.main"}>
                    {verificationResult}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      )}
    </Stack>
  );
};
